import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronDown, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Share2, 
  MessageSquare, 
  Mail, 
  Copy, 
  Inbox,
  ExternalLink 
} from 'lucide-react';
import { Client, ClientFormSubmission } from '../../types';
import { 
  formatCpfCnpj, 
  formatCep, 
  formatPhone, 
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj 
} from '../../lib/formatters';
import { 
  getClientSubmissions, 
  findSubmissionByDocument, 
  markSubmissionImported 
} from '../../lib/clientSubmissions';
import { isValidUUID, generateUUID } from '../../lib/supabaseService';

export interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (client: Client) => void;
  onSuccess?: (client: Client) => void;
  editingClient?: Client | null;
  initialName?: string;
  zIndexClass?: string;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  editingClient,
  initialName = '',
  zIndexClass = 'z-[70]',
}) => {
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cattleType, setCattleType] = useState<'leite' | 'corte' | 'misto' | 'confinamento' | 'outro'>('leite');
  const [headCount, setHeadCount] = useState<string>('');
  const [monthlyDemandTons, setMonthlyDemandTons] = useState<string>('');
  const [status, setStatus] = useState<'lead' | 'contatado' | 'proposta' | 'cliente_ativo' | 'inativo'>('cliente_ativo');
  const [notes, setNotes] = useState('');

  // Lookup loading states
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(editingClient || null);

  // Share & external form state
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<ClientFormSubmission[]>([]);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);

  // Refresh pending client submissions when modal is opened
  useEffect(() => {
    if (isOpen) {
      try {
        const subs = getClientSubmissions();
        setPendingSubmissions(subs.filter(s => s.status === 'pendente'));
      } catch (err) {
        console.error(err);
      }
    }
  }, [isOpen]);

  const getFormUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?ficha=cliente`;
  };

  const handleShareWhatsApp = () => {
    const link = getFormUrl();
    const message = `Olá! Por favor, preencha seus dados de cadastro no Silagem Fácil neste link: ${link}`;
    const targetDigits = cleanDigits(phone);
    const url = targetDigits.length >= 10
      ? `https://api.whatsapp.com/send?phone=55${targetDigits}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    setIsShareDropdownOpen(false);
    setFeedback({ type: 'success', message: 'Abrindo WhatsApp com o link do formulário...' });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleShareEmail = () => {
    const link = getFormUrl();
    const subject = encodeURIComponent('Ficha Cadastral de Cliente / Produtor - Silagem Fácil');
    const body = encodeURIComponent(
      `Olá!\n\nPor favor, preencha seus dados cadastrais no link seguro abaixo para agilizarmos o fornecimento de silagem e emissão de contratos:\n\n${link}\n\nAtenciosamente,\nEquipe Silagem Fácil`
    );
    const mailto = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setIsShareDropdownOpen(false);
    setFeedback({ type: 'success', message: 'Abrindo aplicativo de e-mail com o link do formulário...' });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCopyLink = async () => {
    const link = getFormUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setFeedback({ type: 'success', message: 'Link da ficha copiado para a área de transferência!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar o link automaticamente.' });
    }
    setIsShareDropdownOpen(false);
  };

  const applySubmission = (submission: ClientFormSubmission) => {
    if (submission.nome || submission.name) setName(submission.nome || submission.name);
    if (submission.fazenda || submission.farmName) setFarmName(submission.fazenda || submission.farmName);
    if (submission.cpfCnpj) setCpfCnpj(formatCpfCnpj(submission.cpfCnpj));
    if (submission.stateRegistration) setStateRegistration(submission.stateRegistration);
    if (submission.phone) setPhone(formatPhone(submission.phone));
    if (submission.email) setEmail(submission.email);
    if (submission.zipCode) setZipCode(formatCep(submission.zipCode));
    if (submission.address) setAddress(submission.address);
    if (submission.neighborhood) setNeighborhood(submission.neighborhood);
    if (submission.city) setCity(submission.city);
    if (submission.state) setState(submission.state);
    if (submission.cattleType) setCattleType(submission.cattleType);
    if (submission.headCount) setHeadCount(submission.headCount.toString());
    if (submission.monthlyDemandTons) setMonthlyDemandTons(submission.monthlyDemandTons.toString());
    if (submission.notes) setNotes(submission.notes);

    markSubmissionImported(submission.id);
    setPendingSubmissions(prev => prev.filter(s => s.id !== submission.id));
    setIsImportDropdownOpen(false);

    setFeedback({
      type: 'success',
      message: `✅ Ficha respondida pelo produtor "${submission.name}" importada com sucesso!`
    });
    setTimeout(() => setFeedback(null), 4500);
  };

  useEffect(() => {
    if (editingClient) {
      setCurrentClient(editingClient);
      setName(editingClient.nome || editingClient.name);
      setFarmName(editingClient.fazenda || editingClient.farmName);
      setCpfCnpj(formatCpfCnpj(editingClient.cpfCnpj || ''));
      setStateRegistration(editingClient.stateRegistration || '');
      setZipCode(formatCep(editingClient.zipCode || ''));
      setAddress(editingClient.address || '');
      setNeighborhood(editingClient.neighborhood || '');
      setCity(editingClient.city);
      setState(editingClient.state);
      setPhone(formatPhone(editingClient.phone));
      setEmail(editingClient.email || '');
      setCattleType(editingClient.cattleType);
      setHeadCount(editingClient.headCount ? editingClient.headCount.toString() : '');
      setMonthlyDemandTons(editingClient.monthlyDemandTons ? editingClient.monthlyDemandTons.toString() : '');
      setStatus(editingClient.status);
      setNotes(editingClient.notes || '');
    } else {
      setCurrentClient(null);
      setName(initialName || '');
      setFarmName('');
      setCpfCnpj('');
      setStateRegistration('');
      setZipCode('');
      setAddress('');
      setNeighborhood('');
      setCity('');
      setState('PR');
      setPhone('');
      setEmail('');
      setCattleType('leite');
      setHeadCount('');
      setMonthlyDemandTons('');
      setStatus('cliente_ativo');
      setNotes('');
    }
    setFeedback(null);
  }, [editingClient, isOpen, initialName]);

  // Handle CNPJ / CPF dynamic typing and auto search
  const handleCpfCnpjChange = async (val: string) => {
    const formatted = formatCpfCnpj(val);
    setCpfCnpj(formatted);
    const digits = cleanDigits(val);
    if (digits.length === 11 || digits.length === 14) {
      await searchCnpj(digits);
    }
  };

  const searchCnpj = async (cnpjDigits?: string) => {
    const digits = cnpjDigits || cleanDigits(cpfCnpj);
    if (!digits) {
      setFeedback({ type: 'error', message: 'Digite o CPF ou CNPJ para buscar.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    // 1. Prioridade: Buscar nas fichas externas preenchidas pelo cliente
    const matchedSubmission = findSubmissionByDocument(digits);
    if (matchedSubmission) {
      applySubmission(matchedSubmission);
      return;
    }

    // 2. Se for 14 dígitos (CNPJ) e não estiver nas fichas, busca na Receita Federal
    if (digits.length === 14) {
      setIsLoadingCnpj(true);
      setFeedback(null);
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
          setFeedback({ type: 'success', message: `✅ Dados preenchidos via Receita Federal: ${res.corporateName}` });
        } else {
          setFeedback({ type: 'error', message: res.message || 'CNPJ não encontrado na Receita.' });
        }
      } catch {
        setFeedback({ type: 'error', message: 'Falha ao consultar CNPJ na Receita Federal.' });
      } finally {
        setIsLoadingCnpj(false);
        setTimeout(() => setFeedback(null), 3500);
      }
      return;
    }

    // Se for 11 dígitos (CPF) e não encontrou ficha respondida
    if (digits.length === 11) {
      setFeedback({ type: 'error', message: 'Nenhuma ficha externa respondida encontrada para este CPF.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setFeedback({ type: 'error', message: 'Digite 11 dígitos para CPF ou 14 para CNPJ.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Handle CEP dynamic typing and auto search
  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setZipCode(formatted);
    const digits = cleanDigits(val);
    if (digits.length === 8) {
      await searchCep(digits);
    }
  };

  const searchCep = async (cepDigits?: string) => {
    const digits = cepDigits || cleanDigits(zipCode);
    if (digits.length !== 8) {
      setFeedback({ type: 'error', message: 'Digite um CEP completo com 8 dígitos.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsLoadingCep(true);
    setFeedback(null);
    try {
      const res = await fetchAddressByCep(digits);
      if (res.success) {
        if (res.street) setAddress(res.street);
        if (res.neighborhood) setNeighborhood(res.neighborhood);
        if (res.city) setCity(res.city);
        if (res.state) setState(res.state);
        setFeedback({ type: 'success', message: `✅ Endereço preenchido: ${res.city}/${res.state}` });
      } else {
        setFeedback({ type: 'error', message: res.message || 'CEP não encontrado.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Falha ao consultar CEP.' });
    } finally {
      setIsLoadingCep(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Auto calculate estimated monthly demand based on livestock head count
  const handleHeadCountChange = (countStr: string) => {
    setHeadCount(countStr);
    const count = parseInt(countStr);
    if (!isNaN(count) && count > 0) {
      const factor = cattleType === 'leite' ? 0.55 : cattleType === 'confinamento' ? 0.45 : 0.40;
      setMonthlyDemandTons((count * factor).toFixed(0));
    }
  };

  const activeClient = currentClient || editingClient;

  const handleCancel = () => {
    if (activeClient) {
      setName(activeClient.nome || activeClient.name);
      setFarmName(activeClient.fazenda || activeClient.farmName);
      setCpfCnpj(formatCpfCnpj(activeClient.cpfCnpj || ''));
      setStateRegistration(activeClient.stateRegistration || '');
      setZipCode(formatCep(activeClient.zipCode || ''));
      setAddress(activeClient.address || '');
      setNeighborhood(activeClient.neighborhood || '');
      setCity(activeClient.city);
      setState(activeClient.state);
      setPhone(formatPhone(activeClient.phone));
      setEmail(activeClient.email || '');
      setCattleType(activeClient.cattleType);
      setHeadCount(activeClient.headCount ? activeClient.headCount.toString() : '');
      setMonthlyDemandTons(activeClient.monthlyDemandTons ? activeClient.monthlyDemandTons.toString() : '');
      setStatus(activeClient.status);
      setNotes(activeClient.notes || '');
    } else {
      setName(initialName || '');
      setFarmName('');
      setCpfCnpj('');
      setStateRegistration('');
      setZipCode('');
      setAddress('');
      setNeighborhood('');
      setCity('');
      setState('PR');
      setPhone('');
      setEmail('');
      setCattleType('leite');
      setHeadCount('');
      setMonthlyDemandTons('');
      setStatus('cliente_ativo');
      setNotes('');
    }
    setFeedback({ type: 'error', message: 'Alterações não salvas foram descartadas.' });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !farmName.trim()) {
      setFeedback({ type: 'error', message: 'Preencha o nome do produtor e da fazenda.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const nowIso = new Date().toISOString();
    const isUpdating = Boolean(activeClient);
    const clientId = (activeClient && isValidUUID(activeClient.id))
      ? activeClient.id
      : generateUUID();

    const client: Client = {
      id: clientId,
      name: name.trim(),
      nome: name.trim(),
      farmName: farmName.trim(),
      fazenda: farmName.trim(),
      cpfCnpj: cpfCnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || 'Região',
      state: state.trim() || 'PR',
      phone: phone.trim(),
      email: email.trim() || undefined,
      cattleType,
      headCount: headCount ? parseInt(headCount) : undefined,
      monthlyDemandTons: monthlyDemandTons ? parseFloat(monthlyDemandTons) : undefined,
      status,
      notes: notes.trim() || undefined,
      totalPurchasedTons: activeClient?.totalPurchasedTons || 0,
      totalSpent: activeClient?.totalSpent || 0,
      createdAt: activeClient?.createdAt || nowIso,
      updatedAt: isUpdating ? nowIso : undefined,
    };

    // Update internal state so the form reflects the saved client
    setCurrentClient(client);

    if (onSuccess) {
      onSuccess(client);
    }
    if (onSave) {
      onSave(client);
    }

    // Modal remains OPEN without closing automatically!
    setFeedback({
      type: 'success',
      message: isUpdating ? 'Cliente atualizado com sucesso!' : 'Cliente salvo com sucesso!',
    });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const formatDateTimeBR = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto`}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:w-[90vw] max-w-6xl shadow-2xl border-t sm:border border-zinc-400 overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150 max-h-[95vh] sm:max-h-[92vh] flex flex-col my-0 sm:my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700 relative shrink-0">
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
            Cadastro Cliente
          </h3>
          
          <div className="flex items-center space-x-2">
            {/* Botão Enviar Ficha com Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs sm:text-sm font-semibold transition cursor-pointer border border-zinc-600 shadow-2xs"
                title="Enviar link do formulário de cadastro em branco para o cliente"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                <span>Enviar Ficha</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isShareDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isShareDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsShareDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white text-stone-900 rounded-xl shadow-2xl border border-stone-200 z-20 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1.5 border-b border-stone-100 bg-stone-50/70">
                      <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                        Compartilhar Ficha em Branco
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-emerald-50 text-stone-800 hover:text-emerald-900 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por WhatsApp</span>
                        <span className="text-[10px] text-stone-500 block">Link pronto com mensagem</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareEmail}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium hover:bg-blue-50 text-stone-800 hover:text-blue-900 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-[#0963cb] flex items-center justify-center flex-shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold block">Enviar por E-mail</span>
                        <span className="text-[10px] text-stone-500 block">Dispara via seu cliente de e-mail</span>
                      </div>
                    </button>

                    <div className="my-1 border-t border-stone-100" />

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-stone-100 text-stone-700 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                      <span>{copiedLink ? 'Link copiado!' : 'Copiar Link da Ficha'}</span>
                    </button>

                    <a
                      href={getFormUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-stone-100 text-stone-700 flex items-center space-x-2.5 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                      <span>Visualizar Ficha Externa</span>
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Fechar Modal */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`px-5 py-2 text-xs sm:text-sm font-bold text-white flex items-center justify-between shadow-xs transition ${
            feedback.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-100 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button 
              type="button"
              onClick={() => setFeedback(null)} 
              className="text-white/80 hover:text-white px-2 py-0.5 rounded-sm hover:bg-white/20 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 bg-zinc-100 overflow-y-auto flex-1">
          
          {/* Card 1: Identificação & Contato Principal */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-zinc-300 shadow-2xs space-y-2.5">
            {/* Linha 1: CPF/CNPJ (Busca Automática), Nome do Produtor, Nome da Fazenda */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                    CPF OU CNPJ (AUTO-BUSCA)
                  </label>
                  
                  <div className="flex items-center space-x-2">
                    {/* Badge de fichas recebidas para importação rápida */}
                    {pendingSubmissions.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)}
                          className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-0.5 rounded-md transition flex items-center space-x-1 cursor-pointer shadow-xs"
                          title="Fichas preenchidas online aguardando importação"
                        >
                          <Inbox className="w-3 h-3 text-amber-300" />
                          <span>{pendingSubmissions.length} ficha{pendingSubmissions.length > 1 ? 's' : ''}</span>
                        </button>

                        {isImportDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsImportDropdownOpen(false)} />
                            <div className="absolute left-0 mt-1 w-64 bg-white text-stone-900 rounded-xl shadow-xl border border-stone-200 z-20 overflow-hidden py-1">
                              <div className="px-3 py-1.5 border-b border-stone-100 bg-stone-50">
                                <p className="text-[10px] font-bold text-stone-600 uppercase">Fichas Online Recebidas</p>
                              </div>
                              <div className="max-h-48 overflow-y-auto divide-y divide-stone-100">
                                {pendingSubmissions.map(sub => (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => applySubmission(sub)}
                                    className="w-full px-3 py-2 text-left hover:bg-zinc-100 transition flex flex-col cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs text-stone-900">{sub.name}</span>
                                      <span className="text-[10px] text-stone-500">{sub.city}/{sub.state}</span>
                                    </div>
                                    <span className="text-[11px] text-stone-600 font-medium">{sub.farmName}</span>
                                    <span className="text-[10px] text-zinc-700">{sub.cpfCnpj || sub.phone}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {isLoadingCnpj && (
                      <span className="text-[10px] text-zinc-700 font-bold flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
                        <span>Buscando...</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => handleCpfCnpjChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={18}
                    className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => searchCnpj()}
                    disabled={isLoadingCnpj}
                    title="Buscar dados deste CNPJ na Receita ou importar ficha do cliente"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-700 hover:text-emerald-700 rounded-md transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  NOME DO PRODUTOR / RESPONSÁVEL <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  NOME DA FAZENDA / PROPRIEDADE <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Linha 2: Inscrição Estadual (IE) / CADPRO e Telefone / WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  INSCRIÇÃO ESTADUAL (IE) / CADPRO
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  WHATSAPP / TELEFONE
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={15}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: CEP, Endereço, Cidade e UF */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-zinc-300 shadow-2xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                    CEP
                  </label>
                  {isLoadingCep && (
                    <span className="text-[10px] text-zinc-700 font-bold flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
                      <span>Buscando...</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => searchCep()}
                    disabled={isLoadingCep}
                    title="Buscar endereço deste CEP"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-700 hover:text-emerald-700 rounded-md transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  ENDEREÇO / LINHA RURAL
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  BAIRRO / COMUNIDADE
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  UF / ESTADO
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Atividade Pecuária, Cabeças & Demanda */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-zinc-300 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  ATIVIDADE PECUÁRIA
                </label>
                <div className="relative">
                  <select
                    value={cattleType}
                    onChange={(e) => setCattleType(e.target.value as any)}
                    className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white text-black focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium appearance-none pr-8 cursor-pointer"
                  >
                    <option value="leite">Gado de Leite</option>
                    <option value="confinamento">Confinamento de Corte</option>
                    <option value="misto">Gado Misto</option>
                    <option value="corte">Cria & Recria de Corte</option>
                    <option value="outro">Equinos / Ovinos / Outro</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  Nº DE CABEÇAS
                </label>
                <input
                  type="number"
                  value={headCount}
                  onChange={(e) => handleHeadCountChange(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white text-black focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  DEMANDA ESTIMADA (TON/MÊS)
                </label>
                <input
                  type="number"
                  value={monthlyDemandTons}
                  onChange={(e) => setMonthlyDemandTons(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white text-black focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card 4: CRM, E-mail & Observações */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-zinc-300 shadow-2xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  STATUS NO FUNIL CRM
                </label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none pr-8 cursor-pointer"
                  >
                    <option value="lead">Lead / Novo Contato</option>
                    <option value="contatado">Contatado / Em Qualificação</option>
                    <option value="proposta">Proposta / Cotação Enviada</option>
                    <option value="cliente_ativo">Cliente Ativo (Comprando)</option>
                    <option value="inativo">Inativo / Pausado</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  E-MAIL (OPCIONAL)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-1">
                OBSERVAÇÕES TÉCNICAS / PREFERÊNCIAS
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none h-14 sm:h-16 leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2.5 border-t border-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Auditoria Automática (Canto inferior esquerdo) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-zinc-700">
              <span className="inline-flex items-center space-x-1">
                <span className="font-bold text-zinc-900">Cadastrado em:</span>
                <span className="text-zinc-700">
                  {activeClient ? (formatDateTimeBR(activeClient.createdAt) || '—') : formatDateTimeBR(new Date().toISOString())}
                </span>
              </span>
              <span className="text-zinc-400 hidden sm:inline">•</span>
              <span className="inline-flex items-center space-x-1">
                <span className="font-bold text-zinc-900">Alterado em:</span>
                <span className="text-zinc-700">
                  {activeClient?.updatedAt ? (formatDateTimeBR(activeClient.updatedAt) || 'Sem alterações') : 'Sem alterações'}
                </span>
              </span>
            </div>

            {/* Ações (Canto inferior direito: [Cancelar] [Sair] [Atualizar Cliente]) */}
            <div className="flex items-center justify-end space-x-2 sm:space-x-2.5">
              <button
                type="button"
                onClick={handleCancel}
                title="Descartar alterações não salvas"
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer border border-zinc-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Fechar janela de cadastro"
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer border border-zinc-400"
              >
                Sair
              </button>
              <button
                type="submit"
                className="px-5 sm:px-6 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-900 active:bg-zinc-950 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer border border-zinc-900"
              >
                {activeClient ? 'Atualizar Cliente' : 'Salvar Cliente'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

// Aliases para uso unificado e flexível em outros módulos
export const NewClientModal = ClientModal;
export const UnifiedClientModal = ClientModal;
export default ClientModal;
