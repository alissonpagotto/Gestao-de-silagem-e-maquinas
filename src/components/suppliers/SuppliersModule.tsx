import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Trash2, 
  MessageCircle,
  Pencil,
} from 'lucide-react';
import { Supplier } from '../../types';
import { cleanDigits, formatCpfCnpj, formatIE } from '../../lib/formatters';
import { SupplierModal } from './SupplierModal';
import { useConfirm } from '../../context/ConfirmContext';

interface SuppliersModuleProps {
  suppliers: Supplier[];
  onSaveSuppliers: (suppliers: Supplier[]) => void;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({
  suppliers,
  onSaveSuppliers,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sup.tradeName && sup.tradeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sup.city && sup.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sup.cnpjOrCpf && sup.cnpjOrCpf.includes(searchTerm)) ||
    (sup.stateRegistration && sup.stateRegistration.includes(searchTerm)) ||
    (sup.municipalRegistration && sup.municipalRegistration.includes(searchTerm))
  );

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const sup = suppliers.find(s => s.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Fornecedor',
      message: sup?.name
        ? `Deseja realmente excluir o fornecedor "${sup.name}"?`
        : 'Deseja realmente excluir este fornecedor?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  return (
    <div id="suppliers-module" className="w-full max-w-none bg-[#0a8bc1] rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 text-black border-2 border-white/20">
      
      {/* 1. Cabeçalho: Título "Fornecedores" no topo esquerdo e Botão verde no topo direito */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight font-['Outfit']">
            Fornecedores
          </h2>
          <p className="text-xs text-black font-bold mt-0.5">
            Cadastro e gestão de fornecedores de insumos, peças e serviços
          </p>
        </div>

        <button
          type="button"
          id="btn-cadastrar-fornecedor"
          onClick={handleOpenNew}
          className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#009688] hover:bg-[#00796b] text-white shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Cadastrar Fornecedor</span>
        </button>
      </div>

      {/* 2. Barra de Pesquisa Superior */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="input-buscar-fornecedor"
          placeholder="Buscar fornecedor por razão social, CNPJ, categoria ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/95 text-black placeholder:text-stone-500 border border-[#96c1e5] rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-[#009688] focus:bg-white outline-none transition shadow-2xs"
        />
      </div>

      {/* 3. Cabeçalho de Colunas para Desktop */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-black text-black uppercase tracking-wider bg-[#b0d2ed]/60 rounded-xl border border-[#96c1e5]/60 shadow-2xs">
        <div className="col-span-4">Nome / Razão Social</div>
        <div className="col-span-3">CNPJ/CPF & IE</div>
        <div className="col-span-2">Telefone</div>
        <div className="col-span-2">Endereço / Cidade</div>
        <div className="col-span-1 text-right">Ações</div>
      </div>

      {/* 4. Listagem Linear de Fornecedores (Linhas verticais uma abaixo da outra com 100% de largura) */}
      <div className="space-y-2.5 w-full">
        {filteredSuppliers.length === 0 ? (
          <div className="p-8 text-center bg-[#b0d2ed] rounded-xl border border-[#96c1e5] text-black">
            <Building className="w-8 h-8 text-black/60 mx-auto mb-2" />
            <p className="text-sm font-black text-black">Nenhum fornecedor encontrado</p>
            <p className="text-xs text-black/80 font-semibold mt-1">
              Tente alterar os termos de busca ou clique no botão acima para cadastrar um novo fornecedor.
            </p>
          </div>
        ) : (
          filteredSuppliers.map((sup) => (
            <div 
              key={sup.id}
              className="bg-[#b0d2ed] border border-[#96c1e5] hover:border-[#7faecf] rounded-xl p-3 sm:p-4 shadow-2xs transition text-black"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center">
                
                {/* Coluna 1: Nome / Razão Social com tag de Categoria ao lado */}
                <div className="lg:col-span-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-black text-sm sm:text-base truncate" title={sup.name}>
                      {sup.name}
                    </h3>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/90 text-black border border-[#96c1e5] shrink-0 shadow-2xs">
                      {sup.category}
                    </span>
                  </div>
                  {sup.tradeName && sup.tradeName !== sup.name && (
                    <p className="text-xs text-black/80 font-bold truncate mt-0.5" title={sup.tradeName}>
                      Fantasia: {sup.tradeName}
                    </p>
                  )}
                </div>

                {/* Coluna 2: CNPJ/CPF & IE */}
                <div className="lg:col-span-3 min-w-0">
                  <div className="text-xs text-black font-semibold space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <Building className="w-3.5 h-3.5 text-black/70 shrink-0" />
                      <span className="font-bold text-black truncate">
                        {sup.cnpjOrCpf ? formatCpfCnpj(sup.cnpjOrCpf) : 'CNPJ/CPF não inf.'}
                      </span>
                    </div>
                    {sup.stateRegistration ? (
                      <div className="text-[11px] text-black/80 pl-5 font-medium truncate">
                        IE: {formatIE(sup.stateRegistration)}
                      </div>
                    ) : (
                      sup.municipalRegistration && (
                        <div className="text-[11px] text-black/80 pl-5 font-medium truncate">
                          IM: {sup.municipalRegistration}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Coluna 3: Telefone */}
                <div className="lg:col-span-2 min-w-0">
                  <div className="text-xs text-black font-semibold space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-black/70 shrink-0" />
                      <span className="font-bold text-black truncate">
                        {sup.phone || 'Sem telefone'}
                      </span>
                    </div>
                    {sup.email && (
                      <div className="text-[11px] text-black/80 pl-5 font-medium truncate" title={sup.email}>
                        {sup.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 4: Endereço / Cidade */}
                <div className="lg:col-span-2 min-w-0">
                  <div className="text-xs text-black font-semibold space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-black/70 shrink-0" />
                      <span className="font-bold text-black truncate">
                        {sup.city ? `${sup.city}${sup.state ? `/${sup.state}` : ''}` : 'Cidade não inf.'}
                      </span>
                    </div>
                    {sup.address && (
                      <div className="text-[11px] text-black/80 pl-5 font-medium truncate" title={sup.address}>
                        {sup.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 5: Ações (WhatsApp, Lápis para Editar e Lixeira para Excluir) */}
                <div className="lg:col-span-1 flex items-center justify-start lg:justify-end gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#96c1e5]/60 shrink-0">
                  {/* Ícone do WhatsApp */}
                  {sup.phone && cleanDigits(sup.phone).length >= 10 ? (
                    <a
                      href={`https://wa.me/55${cleanDigits(sup.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center justify-center"
                      title="Conversar no WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4 stroke-[2.2]" />
                    </a>
                  ) : (
                    <span 
                      className="p-1.5 text-black/30 cursor-not-allowed inline-flex items-center justify-center" 
                      title="Sem telefone cadastrado para WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4 opacity-40" />
                    </span>
                  )}

                  {/* Lápis para Editar */}
                  <button
                    type="button"
                    onClick={() => handleEdit(sup)}
                    className="p-1.5 bg-white/90 hover:bg-white text-black hover:text-amber-800 border border-[#96c1e5] rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center justify-center"
                    title="Editar fornecedor"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Lixeira para Excluir */}
                  <button
                    type="button"
                    onClick={() => handleDelete(sup.id)}
                    className="p-1.5 bg-white/90 hover:bg-white text-black hover:text-rose-800 border border-[#96c1e5] rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center justify-center"
                    title="Excluir fornecedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Reutilizável de Cadastro / Edição de Fornecedor */}
      <SupplierModal
        isOpen={isModalOpen}
        editingSupplier={editingSupplier}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={(savedSup) => {
          const index = suppliers.findIndex(s => s.id === savedSup.id);
          if (index >= 0) {
            const updated = [...suppliers];
            updated[index] = savedSup;
            onSaveSuppliers(updated);
          } else {
            onSaveSuppliers([...suppliers, savedSup]);
          }
        }}
      />

    </div>
  );
};
