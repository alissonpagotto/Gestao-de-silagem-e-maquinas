import React, { useMemo, useRef, useEffect } from 'react';
import { 
  Briefcase, 
  Search, 
  X, 
  CheckCircle2, 
  Check, 
  SlidersHorizontal, 
  ShieldCheck,
  Building2,
  AlertCircle
} from 'lucide-react';
import { RoleOptionItem } from './RoleSelectDropdown';

interface RoleSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: 'role1' | 'role2';
  currentValue: string;
  disabledValue?: string;
  onSelectRole: (roleName: string) => void;
  options: RoleOptionItem[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onOpenManager?: () => void;
}

export const RoleSidePanel: React.FC<RoleSidePanelProps> = ({
  isOpen,
  onClose,
  targetRole,
  currentValue,
  disabledValue,
  onSelectRole,
  options = [],
  searchQuery,
  onSearchQueryChange,
  onOpenManager,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isRole1 = targetRole === 'role1';

  // Foco no input de busca ao abrir o painel
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, targetRole]);

  // Normalização e ORDEM ALFABÉTICA COMPULSÓRIA (A-Z)
  const sortedOptions = useMemo(() => {
    const list = [...options];
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [options]);

  // Filtro interativo por digitação (nome, setor ou descrição)
  const filteredOptions = useMemo(() => {
    const term = (searchQuery || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!term) return sortedOptions;

    return sortedOptions.filter((opt) => {
      const normName = opt.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normSetor = (opt.setor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normDesc = (opt.descricao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normName.includes(term) || normSetor.includes(term) || normDesc.includes(term);
    });
  }, [sortedOptions, searchQuery]);

  // Cores por setor para distinção visual
  const getSectorBadgeStyle = (setorName?: string) => {
    const s = (setorName || '').toUpperCase();
    if (s.includes('DIRETORIA') || s.includes('ADMIN')) {
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    }
    if (s.includes('FINANCEIRO') || s.includes('CONTAB')) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    }
    if (s.includes('RH') || s.includes('RECURSOS')) {
      return 'bg-purple-100 text-purple-900 border-purple-200';
    }
    if (s.includes('TRANSPORTE') || s.includes('LOGÍSTICA')) {
      return 'bg-blue-100 text-blue-900 border-blue-200';
    }
    if (s.includes('OFICINA') || s.includes('MANUTEN')) {
      return 'bg-orange-100 text-orange-900 border-orange-200';
    }
    return 'bg-amber-100 text-amber-900 border-amber-200';
  };

  if (!isOpen) return null;

  return (
    <aside 
      className="w-full sm:w-96 md:w-[420px] bg-white border-l border-[#0963cb]/20 flex flex-col shrink-0 shadow-2xl z-20 animate-in slide-in-from-right duration-200 overflow-hidden"
      aria-label="Painel Lateral de Seleção de Cargos"
    >
      {/* Header do Painel */}
      <div className="px-4 py-3.5 bg-[#0963cb] text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          <div className="p-1.5 bg-white/15 rounded-lg shrink-0">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="truncate">
            <h4 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
              <span>{isRole1 ? 'Cargo Principal' : 'Cargo Secundário'}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                isRole1 ? 'bg-amber-400 text-black' : 'bg-white/20 text-white'
              }`}>
                {isRole1 ? 'Obrigatório' : 'Opcional'}
              </span>
            </h4>
            <p className="text-[11px] text-white/80 truncate">
              {isRole1 ? 'Defina a função principal do colaborador' : 'Acúmulo de função ou atribuição complementar'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white hover:bg-white/20 transition cursor-pointer shrink-0"
          title="Fechar painel de cargos"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Caixa de Busca com Digitação Interativa */}
      <div className="p-3 bg-stone-50 border-b border-stone-200 shrink-0 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Digite para filtrar (ex: Mec, Forra, Oper)..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0963cb]/30 focus:border-[#0963cb] shadow-2xs placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metadados e Contador A-Z */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 px-0.5">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            {filteredOptions.length} {filteredOptions.length === 1 ? 'cargo disponível' : 'cargos disponíveis'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0963cb] uppercase tracking-wider bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
            Ordem Alfabética (A-Z)
          </span>
        </div>
      </div>

      {/* Opção de Nenhuma / Limpar para Cargo Secundário */}
      {!isRole1 && (
        <div className="px-3 pt-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectRole('');
              onSearchQueryChange('');
            }}
            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
              !currentValue
                ? 'bg-sky-50/90 border-[#0963cb] text-[#0963cb] font-bold shadow-2xs ring-1 ring-[#0963cb]/30'
                : 'bg-white border-dashed border-stone-300 text-stone-600 hover:bg-stone-50 hover:border-stone-400'
            }`}
          >
            <div className="text-xs">
              <span className="font-semibold">— Nenhum cargo secundário —</span>
              <p className="text-[10px] text-stone-400">Sem acúmulo de função na empresa</p>
            </div>
            {!currentValue && (
              <Check className="w-4 h-4 text-[#0963cb] shrink-0" />
            )}
          </button>
        </div>
      )}

      {/* Lista de Cargos com Largura Ampla (Sem cortes de palavras) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt, index) => {
            const optName = opt.name;
            const isSelected = currentValue.trim().toLowerCase() === optName.trim().toLowerCase();
            const isAlreadyChosen = disabledValue && disabledValue.trim().toLowerCase() === optName.trim().toLowerCase();

            return (
              <div
                key={`${optName}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelectRole(optName);
                  onSearchQueryChange('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRole(optName);
                    onSearchQueryChange('');
                  }
                }}
                className={`group p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50/90 border-[#0963cb] shadow-xs ring-1 ring-[#0963cb]/40'
                    : isAlreadyChosen
                    ? 'bg-stone-50/70 border-stone-200 opacity-75 hover:opacity-100'
                    : 'bg-white border-stone-200 hover:border-[#0963cb]/60 hover:bg-stone-50/80 shadow-2xs'
                }`}
              >
                {/* Linha Superior: Nome do Cargo & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs sm:text-sm font-bold break-words leading-tight ${
                        isSelected ? 'text-[#0963cb]' : 'text-stone-900 group-hover:text-black'
                      }`}>
                        {optName}
                      </span>
                      {isAlreadyChosen && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 uppercase">
                          Cargo Principal
                        </span>
                      )}
                    </div>

                    {/* Setor Obrigatório Formatado */}
                    {opt.setor && (
                      <div className="pt-0.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getSectorBadgeStyle(opt.setor)}`}>
                          <Building2 className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          <span>{opt.setor}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Indicador de Seleção */}
                  <div className="shrink-0 pt-0.5">
                    {isSelected ? (
                      <div className="flex items-center space-x-1 text-xs font-bold text-[#0963cb] bg-white border border-[#0963cb]/30 px-2 py-0.5 rounded-full shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0963cb]" />
                        <span>Ativo</span>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-stone-300 group-hover:border-[#0963cb] flex items-center justify-center transition">
                        <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[#0963cb]/40 transition"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descrição / Atribuições do Cargo */}
                {opt.descricao && (
                  <p className="text-[11px] text-stone-500 mt-1.5 leading-snug break-words">
                    {opt.descricao}
                  </p>
                )}

                {/* Níveis de Acesso Rápidos Herdados */}
                {opt.permissoes && (
                  <div className="mt-2 pt-1.5 border-t border-stone-100 flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-stone-400 font-bold mr-0.5 flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3 text-stone-400" />
                      Acessos:
                    </span>
                    {opt.permissoes.financeiro && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        Financeiro
                      </span>
                    )}
                    {opt.permissoes.frotas && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                        Frotas
                      </span>
                    )}
                    {opt.permissoes.rh && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                        RH
                      </span>
                    )}
                    {opt.permissoes.estoque && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                        Estoque
                      </span>
                    )}
                    {!opt.permissoes.financeiro && !opt.permissoes.frotas && !opt.permissoes.rh && !opt.permissoes.estoque && (
                      <span className="text-stone-400 italic">Básico operacional</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-8 px-4 text-center space-y-2 bg-stone-50 rounded-xl border border-dashed border-stone-200">
            <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
            <div className="text-xs font-bold text-stone-700">Nenhum cargo encontrado</div>
            <p className="text-[11px] text-stone-500">
              Não encontramos resultados para &quot;{searchQuery}&quot;. Você pode cadastrar um novo cargo abaixo.
            </p>
          </div>
        )}
      </div>

      {/* Rodapé do Painel com Ações */}
      <div className="p-3 border-t border-stone-200 bg-stone-50 shrink-0 space-y-2">
        {onOpenManager && (
          <button
            type="button"
            onClick={onOpenManager}
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:text-black bg-white border border-stone-300 hover:bg-stone-100 hover:border-stone-400 shadow-2xs transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0963cb]" />
            <span>Gerenciar lista de cargos oficiais</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-1.5 rounded-lg text-xs font-bold text-white bg-[#0963cb] hover:bg-[#074ea3] shadow-2xs transition cursor-pointer"
        >
          Concluir Seleção
        </button>
      </div>
    </aside>
  );
};
