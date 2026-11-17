import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  X,
  Clock,
  CalendarClock,
  Power,
  AlertCircle,
} from 'lucide-react';
import { FormaPagamentoItem } from '../../types';
import {
  useGlobalPaymentMethods,
  saveGlobalPaymentMethods,
  resetGlobalPaymentMethodsToDefault,
  getPaymentMethodKey,
} from '../../lib/paymentMethodsStorage';

interface PaymentMethodsManagerPanelProps {
  compact?: boolean;
  onChanged?: () => void;
  onSelectMethod?: (methodKey: string) => void;
}

export const PaymentMethodsManagerPanel: React.FC<PaymentMethodsManagerPanelProps> = ({
  compact = false,
  onChanged,
  onSelectMethod,
}) => {
  const { allMethods } = useGlobalPaymentMethods();
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form Inline (Criar / Editar)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormaPagamentoItem | null>(null);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<FormaPagamentoItem['tipo']>('outro');
  const [geraParcelaPrazo, setGeraParcelaPrazo] = useState(false);
  const [prazoDias, setPrazoDias] = useState<number>(0);
  const [ativo, setAtivo] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const safeAllMethods = useMemo(
    () => (Array.isArray(allMethods) ? allMethods.filter((m): m is FormaPagamentoItem => Boolean(m && typeof m === 'object')) : []),
    [allMethods]
  );

  const filteredMethods = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return safeAllMethods;
    return safeAllMethods.filter(
      (m) =>
        String(m?.nome || '').toLowerCase().includes(q) ||
        String(m?.codigo || '').toLowerCase().includes(q) ||
        String(m?.tipo || '').toLowerCase().includes(q)
    );
  }, [safeAllMethods, searchTerm]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setNome('');
    setCodigo('');
    setTipo('outro');
    setGeraParcelaPrazo(false);
    setPrazoDias(0);
    setAtivo(true);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: FormaPagamentoItem) => {
    setEditingItem(item);
    setNome(String(item?.nome || ''));
    setCodigo(String(item?.codigo || ''));
    setTipo((item?.tipo as FormaPagamentoItem['tipo']) || 'outro');
    setGeraParcelaPrazo(Boolean(item?.geraParcelaPrazo));
    setPrazoDias(Number(item?.prazoDias) || 0);
    setAtivo(item?.ativo !== false);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanNome = nome.trim().toUpperCase();
    if (!cleanNome) {
      setErrorMsg('INFORME O NOME DA FORMA DE PAGAMENTO / RECEBIMENTO.');
      return;
    }

    const cleanCodigo =
      codigo.trim().toUpperCase() ||
      cleanNome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (editingItem) {
      const updatedItem: FormaPagamentoItem = {
        ...editingItem,
        nome: cleanNome,
        codigo: cleanCodigo,
        tipo,
        geraParcelaPrazo,
        prazoDias: Number(prazoDias) || 0,
        ativo,
      };
      const updated = safeAllMethods.map((m) =>
        m.id === editingItem.id ? updatedItem : m
      );
      saveGlobalPaymentMethods(updated);
      showToast(`"${cleanNome}" atualizado em todos os módulos!`);
      if (ativo !== false) {
        onSelectMethod?.(getPaymentMethodKey(updatedItem));
      }
    } else {
      const duplicate = safeAllMethods.some(
        (m) =>
          String(m?.nome || '').trim().toUpperCase() === cleanNome ||
          String(m?.codigo || '').trim().toUpperCase() === cleanCodigo
      );
      if (duplicate) {
        setErrorMsg('JÁ EXISTE UMA FORMA DE PAGAMENTO COM ESTE NOME OU CÓDIGO.');
        return;
      }

      const newItem: FormaPagamentoItem = {
        id: `fp-custom-${Date.now()}`,
        codigo: cleanCodigo,
        nome: cleanNome,
        tipo,
        prazoDias: Number(prazoDias) || 0,
        taxaPercentual: 0,
        geraParcelaPrazo,
        ativo,
        isCustom: true,
        ordem: allMethods.length + 1,
      };
      saveGlobalPaymentMethods([...allMethods, newItem]);
      showToast(`"${cleanNome}" adicionado e sincronizado!`);
      if (ativo !== false) {
        onSelectMethod?.(getPaymentMethodKey(newItem));
      }
    }

    setIsFormOpen(false);
    onChanged?.();
  };

  const handleToggleActive = (item: FormaPagamentoItem) => {
    const updated = allMethods.map((m) =>
      m.id === item.id ? { ...m, ativo: m.ativo === false } : m
    );
    saveGlobalPaymentMethods(updated);
    showToast(`${item.nome}: ${item.ativo === false ? 'ATIVADO' : 'DESATIVADO'}`);
    onChanged?.();
  };

  const handleToggleDeferred = (item: FormaPagamentoItem) => {
    const updated = allMethods.map((m) =>
      m.id === item.id ? { ...m, geraParcelaPrazo: !m.geraParcelaPrazo } : m
    );
    saveGlobalPaymentMethods(updated);
    showToast(
      `${item.nome}: ${!item.geraParcelaPrazo ? 'Gera Parcela a Prazo (Contas a Receber)' : 'Baixa / Pagamento Direto'}`
    );
    onChanged?.();
  };

  const handleDelete = (item: FormaPagamentoItem) => {
    const updated = allMethods.filter((m) => m.id !== item.id);
    if (updated.length === 0) {
      setErrorMsg('É NECESSÁRIO MANTER AO MENOS UMA FORMA DE PAGAMENTO ATIVA.');
      return;
    }
    saveGlobalPaymentMethods(updated);
    showToast(`"${item.nome}" removido.`);
    onChanged?.();
  };

  const handleReset = () => {
    resetGlobalPaymentMethodsToDefault();
    showToast('Lista padrão oficial restaurada (10 modalidades)!');
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-100 border border-black text-emerald-950 text-xs font-black flex items-center gap-2 uppercase">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMsg && !isFormOpen && (
        <div className="p-2.5 rounded-xl bg-rose-100 border border-black text-rose-900 text-xs font-black flex items-center gap-2 uppercase">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Cabeçalho Compacto Unificado */}
      <div className="bg-[#cad4e6] border border-black rounded-lg p-2.5 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-white/85 border border-black/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-tight truncate">
                💳 FORMAS DE PAGAMENTO &amp; RECEBIMENTO (LISTA GLOBAL UNIFICADA)
              </h4>
              <p className="text-[11px] font-medium text-slate-700 leading-tight truncate">
                Sincronizado em tempo real com PDV, Serviços, Financeiro a Receber / a Pagar e Fiscal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/85 border border-black/40 text-[11px] font-black uppercase text-slate-900 whitespace-nowrap">
              <span>{filteredMethods.length}</span>
              <span className="text-[10px] font-bold text-slate-700">MODALIDADE(S)</span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              title="Restaurar as 10 formas de pagamento padrão"
              className="px-2.5 py-1 rounded-md bg-white/85 hover:bg-white border border-black text-slate-900 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition uppercase whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Restaurar Padrão</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 border border-emerald-900 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition uppercase shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nova Forma</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-black/20 flex items-center justify-between gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar modalidade ou chave..."
              className="w-full pl-8 pr-7 py-1 bg-white border border-black/40 rounded-md text-xs text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Formulário Inline Criar / Editar */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="bg-[#e0e6f1] border border-black rounded-xl p-3.5 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-black/20 pb-2">
            <span className="text-xs font-black uppercase text-black">
              {editingItem ? `EDITAR MODALIDADE: ${editingItem.nome}` : 'CADASTRAR NOVA FORMA DE PAGAMENTO / RECEBIMENTO'}
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1 rounded bg-white border border-black text-black hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-2 rounded-lg bg-rose-100 border border-black text-rose-900 text-[11px] font-black uppercase flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                Nome da Forma de Pagamento *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="EX: PERMUTA GRÃOS / VALE / PIX"
                className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black uppercase outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                Código / Sigla
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="AUTO"
                className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black uppercase outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                Comportamento / Categoria
              </label>
              <select
                value={tipo}
                onChange={(e) => {
                  const val = e.target.value as FormaPagamentoItem['tipo'];
                  setTipo(val);
                  if (
                    val === 'boleto' ||
                    val === 'cheque' ||
                    val === 'prazo_carteira' ||
                    val === 'safra_prazo' ||
                    val === 'assinado_nota'
                  ) {
                    setGeraParcelaPrazo(true);
                  }
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black uppercase outline-none cursor-pointer"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">DINHEIRO</option>
                <option value="cartao_credito">CARTÃO DE CRÉDITO</option>
                <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                <option value="boleto">BOLETO</option>
                <option value="cheque">CHEQUE</option>
                <option value="transferencia">TED / DOC / TRANSFERÊNCIA</option>
                <option value="prazo_carteira">A PRAZO (CARTEIRA)</option>
                <option value="safra_prazo">SAFRA A PRAZO</option>
                <option value="assinado_nota">ASSINADO NOTA</option>
                <option value="outro">OUTRA MODALIDADE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
            <div>
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                Prazo Padrão (Dias)
              </label>
              <input
                type="number"
                min="0"
                value={prazoDias}
                onChange={(e) => setPrazoDias(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black outline-none"
              />
            </div>

            <label className="flex items-center gap-2 bg-white border border-black rounded-lg px-3 py-2 cursor-pointer select-none mt-4 sm:mt-4">
              <input
                type="checkbox"
                checked={geraParcelaPrazo}
                onChange={(e) => setGeraParcelaPrazo(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-[11px] font-black uppercase text-black">
                Gera parcela a prazo automaticamente
              </span>
            </label>

            <label className="flex items-center gap-2 bg-white border border-black rounded-lg px-3 py-2 cursor-pointer select-none mt-0 sm:mt-4">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-[11px] font-black uppercase text-black">
                Modalidade Ativa nos Seletores
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-black text-black text-xs font-bold hover:bg-slate-100 cursor-pointer uppercase"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-900 text-white text-xs font-black cursor-pointer uppercase"
            >
              {editingItem ? 'Salvar Alterações' : 'Cadastrar e Sincronizar'}
            </button>
          </div>
        </form>
      )}

      {/* Tabela Compacta de Formas Globais */}
      <div className="border border-black rounded-lg overflow-hidden bg-[#e0e6f1] shadow-xs">
        <div className={compact ? 'max-h-[48vh] overflow-y-auto' : 'max-h-[60vh] overflow-y-auto'}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black text-[11px] font-black uppercase text-slate-900">
              <tr>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3">Nome da Forma de Pagamento</th>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3">Chave / Código</th>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3 text-center">Parcela / A Prazo</th>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3 text-center">Prazo</th>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3 text-center">Status</th>
                <th className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black py-2 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-slate-900 font-bold">
              {filteredMethods.map((item) => {
                const isActive = item.ativo !== false;
                const isDeferred = Boolean(item.geraParcelaPrazo);
                const key = getPaymentMethodKey(item);
                return (
                  <tr
                    key={item.id}
                    className={`bg-[#e0e6f1] hover:bg-[#d2dced] border-b border-black/20 last:border-b-0 transition-colors ${
                      !isActive ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="py-2 px-3 uppercase font-black">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{item.nome}</span>
                        {item.isCustom && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-100 border border-sky-700 text-sky-900 text-[9px] font-black">
                            CUSTOM
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-700 uppercase">
                      {key}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleDeferred(item)}
                        title="Clique para alternar se gera parcela a prazo automaticamente"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase cursor-pointer transition ${
                          isDeferred
                            ? 'bg-amber-100 border-black text-amber-950'
                            : 'bg-white border-gray-400 text-slate-700 hover:border-black'
                        }`}
                      >
                        <CalendarClock className="w-3 h-3" />
                        <span>{isDeferred ? 'GERA A PRAZO' : 'À VISTA / DIRETO'}</span>
                      </button>
                    </td>
                    <td className="py-2 px-3 text-center text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {item.prazoDias ? `${item.prazoDias}d` : '0d'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        title="Clique para ativar ou desativar"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase cursor-pointer transition ${
                          isActive
                            ? 'bg-emerald-100 border-black text-emerald-950'
                            : 'bg-slate-200 border-gray-400 text-slate-700'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isActive ? 'ATIVO' : 'INATIVO'}</span>
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Renomear / Editar"
                          className="p-1.5 rounded bg-white border border-black/40 hover:border-black text-black hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {item.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Excluir modalidade customizada"
                            className="p-1.5 rounded bg-white border border-black/40 hover:border-rose-700 text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface PaymentMethodsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onSelectMethod?: (methodKey: string) => void;
  zIndexClass?: string;
}

export const PaymentMethodsManagerModal: React.FC<PaymentMethodsManagerModalProps> = ({
  isOpen,
  onClose,
  onChanged,
  onSelectMethod,
  zIndexClass = 'z-[70]',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-black/60 backdrop-blur-none flex items-center justify-center p-2 sm:p-4 overflow-hidden`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[88vw] max-w-[1150px] h-[88vh] max-h-[88vh] bg-[#cad4e6] border border-black rounded-xl shadow-2xl flex flex-col justify-between mx-auto my-auto overflow-hidden text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-[#cad4e6] px-4 sm:px-5 py-3 border-b border-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-black">
                GERENCIAR FORMAS DE PAGAMENTO & RECEBIMENTO
              </h3>
              <p className="text-[11px] font-semibold text-black/80 uppercase">
                REPOSITÓRIO ÚNICO GLOBAL SINCRONIZADO EM TODO O SISTEMA AGROCONTROL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-black text-black cursor-pointer transition"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-[#cad4e6]">
          <PaymentMethodsManagerPanel compact onChanged={onChanged} onSelectMethod={onSelectMethod} />
        </div>

        {/* Rodapé */}
        <div className="bg-[#cad4e6] px-4 sm:px-5 py-3 border-t border-black flex items-center justify-between shrink-0">
          <span className="text-[10.5px] font-bold uppercase text-black/80">
            ALTERAÇÕES REFLETEM IMEDIATAMENTE EM TODOS OS SELETORES
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-900 text-white text-xs font-black uppercase cursor-pointer transition"
          >
            CONCLUÍDO
          </button>
        </div>
      </div>
    </div>
  );
};
