import React, { useState, useMemo } from 'react';
import { 
  Users, 
  X, 
  Search, 
  Briefcase, 
  Building2, 
  CheckCircle2, 
  Phone, 
  Calendar, 
  ShieldCheck,
  User,
  AlertCircle
} from 'lucide-react';
import { CargoPermissao, Employee } from '../../types';

interface CargoEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: CargoPermissao | null;
  employees: Employee[];
}

export const CargoEmployeesModal: React.FC<CargoEmployeesModalProps> = ({
  isOpen,
  onClose,
  cargo,
  employees = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Identifica todos os colaboradores vinculados ao cargo (como principal ou secundário)
  const linkedEmployees = useMemo(() => {
    if (!cargo) return [];

    const cargoNomeLower = cargo.nome.trim().toLowerCase();
    const cargoId = cargo.id;

    return employees.filter(emp => {
      // 1. Vínculo por cargoId direto
      if (emp.cargoId && emp.cargoId === cargoId) return true;

      // 2. Vínculo por nome do cargo principal
      const primaryRole = (emp.role || '').trim().toLowerCase();
      if (primaryRole === cargoNomeLower) return true;

      // 3. Vínculo em roles array (multi-cargo)
      if (Array.isArray(emp.roles) && emp.roles.some(r => r.trim().toLowerCase() === cargoNomeLower)) {
        return true;
      }

      // 4. Vínculo por cargo secundário
      const secRole = ((emp as any).secondaryRole || (emp as any).cargoSecundario || (emp as any).role2 || '').trim().toLowerCase();
      if (secRole === cargoNomeLower) return true;

      return false;
    });
  }, [cargo, employees]);

  // Filtro por nome ou matrícula/CPF
  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return linkedEmployees;

    return linkedEmployees.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      (emp.cpf && emp.cpf.includes(term)) ||
      (emp.registrationType && emp.registrationType.toLowerCase().includes(term))
    );
  }, [linkedEmployees, searchTerm]);

  if (!isOpen || !cargo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Header - Barra Elegante */}
        <div className="px-5 py-4 bg-[#0963cb] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-white/15 text-white shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                Colaboradores Vinculados ao Cargo
              </h3>
              <div className="flex items-center gap-2 text-xs text-white/90 truncate mt-0.5">
                <span className="font-bold underline decoration-white/40">{cargo.nome}</span>
                <span>•</span>
                <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
                  {cargo.setor || 'Geral'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer shrink-0"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Busca e Contador */}
        <div className="p-3.5 bg-stone-50 dark:bg-stone-800/50 border-b border-zinc-200 dark:border-stone-800 shrink-0 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador vinculado por nome ou documento..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0963cb]/30 focus:border-[#0963cb] shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 px-1 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>Total registrado: <strong>{linkedEmployees.length}</strong> {linkedEmployees.length === 1 ? 'colaborador' : 'colaboradores'}</span>
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
              Fonte: LocalStorage ({`colaca_silagem_funcionarios`})
            </span>
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-stone-100 dark:divide-stone-800">
          {filteredList.length > 0 ? (
            filteredList.map((emp) => {
              const isPrimary = (emp.role || '').trim().toLowerCase() === cargo.nome.trim().toLowerCase();
              const photo = emp.photoUrl || (emp as any).foto_url;
              const initials = emp.name
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div 
                  key={emp.id}
                  className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition shadow-2xs"
                >
                  {/* Foto e Nome */}
                  <div className="flex items-center space-x-3 min-w-0">
                    {photo ? (
                      <img 
                        src={photo} 
                        alt={emp.name} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-stone-200 dark:border-stone-700 shadow-2xs shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                        {initials || <User className="w-4 h-4" />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-stone-900 dark:text-white truncate">
                          {emp.name}
                        </h4>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          isPrimary 
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' 
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        }`}>
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>{isPrimary ? 'Cargo Principal' : 'Cargo Secundário / Acúmulo'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 mt-1 flex-wrap">
                        {emp.registrationType && (
                          <span className="font-semibold text-stone-700 dark:text-stone-300">
                            {emp.registrationType}
                          </span>
                        )}
                        {emp.cpf && (
                          <span>CPF: {emp.cpf}</span>
                        )}
                        {emp.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{emp.phone}</span>
                          </span>
                        )}
                        {emp.admissionDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            <span>Admissão: {new Date(emp.admissionDate).toLocaleDateString('pt-BR')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-end sm:shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Ativo no Sistema</span>
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 px-4 text-center space-y-3 bg-stone-50 dark:bg-stone-800/30 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
              <AlertCircle className="w-9 h-9 text-stone-400 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                  {searchTerm ? 'Nenhum resultado para a busca' : 'Nenhum colaborador com este cargo vinculado'}
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
                  {searchTerm 
                    ? `Não encontramos colaboradores vinculados a "${cargo.nome}" com o termo "${searchTerm}".`
                    : `Atualmente nenhum registro em "colaca_silagem_funcionarios" está associado a "${cargo.nome}". Você pode atribuir este cargo a novos colaboradores no módulo de RH / Funcionários.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botão Fechar */}
        <div className="p-3.5 bg-stone-50 dark:bg-stone-800/80 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1.5 text-xs text-stone-500 dark:text-stone-400">
            <ShieldCheck className="w-4 h-4 text-[#0963cb]" />
            <span>Permissões sincronizadas automaticamente ao vincular.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-white font-bold text-xs sm:text-sm transition cursor-pointer active:scale-95"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
