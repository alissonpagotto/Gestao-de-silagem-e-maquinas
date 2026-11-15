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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-hidden overflow-y-hidden animate-in fade-in duration-150" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] text-black flex items-center justify-between shrink-0 border-b border-black">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
              <Users className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black truncate">
                COLABORADORES VINCULADOS AO CARGO
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-800 truncate mt-0.5 font-semibold">
                <span className="font-bold text-black">{cargo.nome}</span>
                <span>•</span>
                <span className="bg-white text-black px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border border-black">
                  {cargo.setor || 'Geral'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer shrink-0"
            title="Fechar janela"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Barra de Busca e Contador */}
        <div className="p-3 bg-[#e0e6f1] border-b border-black shrink-0 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador vinculado por nome ou documento..."
              className="w-full pl-8 pr-8 py-1.5 bg-white border border-gray-400 rounded-lg text-xs text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-black rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-black px-1 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
              <span>Total registrado: <strong>{linkedEmployees.length}</strong> {linkedEmployees.length === 1 ? 'colaborador' : 'colaboradores'}</span>
            </span>
            <span className="text-[11px] text-slate-700 font-mono">
              Fonte: LocalStorage ({`colaca_silagem_funcionarios`})
            </span>
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 bg-[#cad4e6]">
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#e0e6f1] border border-black hover:bg-white transition shadow-2xs"
                >
                  {/* Foto e Nome */}
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {photo ? (
                      <img 
                        src={photo} 
                        alt={emp.name} 
                        className="w-8 h-8 rounded-full object-cover border border-black shadow-2xs shrink-0" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white text-black border border-black flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                        {initials || <User className="w-3.5 h-3.5" />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-black uppercase text-black truncate">
                          {emp.name}
                        </h4>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${
                          isPrimary 
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-600' 
                            : 'bg-amber-100 text-amber-950 border border-amber-600'
                        }`}>
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          <span>{isPrimary ? 'Principal' : 'Secundário'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-700 mt-0.5 flex-wrap whitespace-nowrap font-medium">
                        {emp.registrationType && (
                          <span className="font-semibold text-black uppercase">
                            {emp.registrationType}
                          </span>
                        )}
                        {emp.cpf && (
                          <span>CPF: {emp.cpf}</span>
                        )}
                        {emp.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 text-slate-600" />
                            <span>{emp.phone}</span>
                          </span>
                        )}
                        {emp.admissionDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-slate-600" />
                            <span>Adm: {new Date(emp.admissionDate).toLocaleDateString('pt-BR')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-end sm:shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-600 px-2 py-0.5 rounded uppercase whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      <span>Ativo</span>
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 px-4 text-center space-y-3 bg-[#e0e6f1] rounded-xl border border-black">
              <AlertCircle className="w-9 h-9 text-slate-700 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-black">
                  {searchTerm ? 'Nenhum resultado para a busca' : 'Nenhum colaborador com este cargo vinculado'}
                </h4>
                <p className="text-xs text-slate-800 max-w-md mx-auto mt-1">
                  {searchTerm 
                    ? `Não encontramos colaboradores vinculados a "${cargo.nome}" com o termo "${searchTerm}".`
                    : `Atualmente nenhum registro em "colaca_silagem_funcionarios" está associado a "${cargo.nome}". Você pode atribuir este cargo a novos colaboradores no módulo de RH / Funcionários.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botão Fechar */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-t border-black flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1.5 text-xs text-black font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Permissões sincronizadas automaticamente ao vincular.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-gray-100 border border-black text-black font-bold text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
