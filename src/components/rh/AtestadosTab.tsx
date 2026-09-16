import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  FileHeart, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  X, 
  FileText, 
  Stethoscope,
  Building2,
  Paperclip,
  Check,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { Employee, MedicalCertificateRecord } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface AtestadosTabProps {
  employees: Employee[];
  certificates: MedicalCertificateRecord[];
  onSaveCertificates: (certificates: MedicalCertificateRecord[]) => void;
}

export const AtestadosTab: React.FC<AtestadosTabProps> = ({
  employees,
  certificates,
  onSaveCertificates,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<MedicalCertificateRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [type, setType] = useState<MedicalCertificateRecord['type']>('Atestado Médico');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [daysCount, setDaysCount] = useState<number>(1);
  const [hoursCount, setHoursCount] = useState<number>(0);
  const [cid, setCid] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [crmCro, setCrmCro] = useState('');
  const [clinic, setClinic] = useState('');
  const [status, setStatus] = useState<MedicalCertificateRecord['status']>('homologado');
  const [attachmentName, setAttachmentName] = useState('');
  const [notes, setNotes] = useState('');

  // Auto calculate days when start and end date change
  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      const d1 = new Date(start + 'T00:00:00');
      const d2 = new Date(end + 'T00:00:00');
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) {
        setDaysCount(diffDays);
        const retDate = new Date(d2.getTime() + 24 * 60 * 60 * 1000);
        setExpectedReturnDate(retDate.toISOString().split('T')[0]);
      }
    } else if (start && !end) {
      const d1 = new Date(start + 'T00:00:00');
      const retDate = new Date(d1.getTime() + (daysCount || 1) * 24 * 60 * 60 * 1000);
      setExpectedReturnDate(retDate.toISOString().split('T')[0]);
    }
  };

  const handleDaysChange = (days: number) => {
    setDaysCount(days);
    if (startDate && days > 0) {
      const d1 = new Date(startDate + 'T00:00:00');
      const endD = new Date(d1.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
      setEndDate(endD.toISOString().split('T')[0]);
      const retD = new Date(d1.getTime() + days * 24 * 60 * 60 * 1000);
      setExpectedReturnDate(retD.toISOString().split('T')[0]);
    }
  };

  // Filtered List
  const filtered = certificates.filter(c => {
    const matchesSearch = 
      c.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.cid && c.cid.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.doctorName && c.doctorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.clinic && c.clinic.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'todos' || c.type === typeFilter;
    const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // KPIs
  const totalCertificates = certificates.length;
  const totalDaysAbonados = certificates
    .filter(c => c.status === 'homologado')
    .reduce((sum, c) => sum + (c.daysCount || 0), 0);
  const inAnalysisCount = certificates.filter(c => c.status === 'em_analise').length;
  const homologatedCount = certificates.filter(c => c.status === 'homologado').length;

  const handleOpenModal = (cert?: MedicalCertificateRecord) => {
    if (cert) {
      setEditingCert(cert);
      setSelectedEmployeeId(cert.employeeId);
      setType(cert.type);
      setStartDate(cert.startDate);
      setEndDate(cert.endDate || '');
      setExpectedReturnDate(cert.expectedReturnDate || '');
      setDaysCount(cert.daysCount || 1);
      setHoursCount(cert.hoursCount || 0);
      setCid(cert.cid || '');
      setDoctorName(cert.doctorName || '');
      setCrmCro(cert.crmCro || '');
      setClinic(cert.clinic || '');
      setStatus(cert.status);
      setAttachmentName(cert.attachmentName || '');
      setNotes(cert.notes || '');
    } else {
      setEditingCert(null);
      const activeEmps = employees.filter(e => e.status !== 'inativo');
      setSelectedEmployeeId(activeEmps.length > 0 ? activeEmps[0].id : '');
      setType('Atestado Médico');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setExpectedReturnDate(tomorrow);
      setDaysCount(1);
      setHoursCount(0);
      setCid('');
      setDoctorName('');
      setCrmCro('');
      setClinic('');
      setStatus('homologado');
      setAttachmentName('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    if (editingCert) {
      const updated = certificates.map(c => c.id === editingCert.id ? {
        ...c,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        type,
        startDate,
        endDate: endDate || undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        daysCount: type === 'Declaração de Horas' ? 0 : daysCount,
        hoursCount: type === 'Declaração de Horas' ? hoursCount : undefined,
        cid: cid ? cid.toUpperCase() : undefined,
        doctorName: doctorName || undefined,
        crmCro: crmCro || undefined,
        clinic: clinic || undefined,
        status,
        attachmentName: attachmentName || undefined,
        notes: notes || undefined,
      } : c);
      onSaveCertificates(updated);
    } else {
      const newCert: MedicalCertificateRecord = {
        id: `cert_${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        type,
        startDate,
        endDate: endDate || undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        daysCount: type === 'Declaração de Horas' ? 0 : daysCount,
        hoursCount: type === 'Declaração de Horas' ? hoursCount : undefined,
        cid: cid ? cid.toUpperCase() : undefined,
        doctorName: doctorName || undefined,
        crmCro: crmCro || undefined,
        clinic: clinic || undefined,
        status,
        attachmentName: attachmentName || undefined,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
      };
      onSaveCertificates([newCert, ...certificates]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const isOk = await confirm({
      title: 'Excluir Atestado',
      message: 'Tem certeza de que deseja remover este registro de atestado médico? Esta ação não pode ser desfeita.',
      confirmLabel: 'Sim, excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isOk) {
      onSaveCertificates(certificates.filter(c => c.id !== id));
    }
  };

  return (
    <div className="w-full max-w-none space-y-4 text-black dark:text-white">
      
      {/* 4 Cards de Métricas (Pink / Rose Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-pink-100/90 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 flex items-center justify-center text-pink-700 dark:text-pink-300 shrink-0">
            <FileHeart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Total de Atestados
            </span>
            <span className="text-2xl font-black text-black dark:text-white mt-0.5 block font-['Outfit']">
              {totalCertificates}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-pink-100/90 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 flex items-center justify-center text-pink-700 dark:text-pink-300 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Dias Abonados
            </span>
            <span className="text-2xl font-black text-black dark:text-pink-400 mt-0.5 block font-['Outfit']">
              {totalDaysAbonados} dias
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Homologados
            </span>
            <span className="text-2xl font-black text-black dark:text-emerald-400 mt-0.5 block font-['Outfit']">
              {homologatedCount}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Em Análise
            </span>
            <span className="text-2xl font-black text-black dark:text-amber-400 mt-0.5 block font-['Outfit']">
              {inAnalysisCount}
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros & Ações */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-black/60 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador, CID, médico ou clínica..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-pink-600 font-medium"
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="Atestado Médico">Atestado Médico</option>
            <option value="Atestado Odontológico">Atestado Odontológico</option>
            <option value="Declaração de Horas">Declaração de Horas</option>
            <option value="Acompanhamento Familiar">Acompanhamento Familiar</option>
            <option value="Licença Maternidade/Paternidade">Licença Maternidade/Paternidade</option>
            <option value="Outro">Outro</option>
          </select>

          {/* Filtro por Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="homologado">Homologados</option>
            <option value="em_analise">Em Análise</option>
            <option value="rejeitado">Rejeitados</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Atestado</span>
        </button>

      </div>

      {/* Tabela de Atestados */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Tipo / Motivo</th>
                <th className="py-2.5 px-3 text-center">Período</th>
                <th className="py-2.5 px-3 text-center">Qtd. Abonada</th>
                <th className="py-2.5 px-3">Previsão Retorno</th>
                <th className="py-2.5 px-3">CID & Emissor</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800">
              {filtered.length > 0 ? (
                filtered.map((cert) => (
                  <tr key={cert.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        cert.status === 'homologado'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                          : cert.status === 'em_analise'
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-rose-100 border-rose-300 text-rose-900'
                      }`}>
                        {cert.status === 'homologado' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Homologado</span>
                          </>
                        ) : cert.status === 'em_analise' ? (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Em Análise</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            <span>Rejeitado</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white">
                        {cert.employeeName}
                      </div>
                      <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium">
                        {cert.employeeRole}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className="font-semibold text-black dark:text-stone-200">
                        {cert.type}
                      </span>
                      {cert.notes && (
                        <div className="text-[10px] text-black/75 dark:text-stone-400 truncate max-w-xs">
                          {cert.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center text-black dark:text-stone-200 font-medium">
                      {formatDateBR(cert.startDate)}
                      {cert.endDate && cert.endDate !== cert.startDate && (
                        <> até {formatDateBR(cert.endDate)}</>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      {cert.type === 'Declaração de Horas' ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold text-[11px]">
                          {cert.hoursCount || 0} hora(s)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-pink-100 dark:bg-pink-950/60 text-pink-900 dark:text-pink-300 font-bold text-[11px]">
                          {cert.daysCount} dia(s)
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-black dark:text-stone-200 font-medium">
                      {cert.expectedReturnDate ? formatDateBR(cert.expectedReturnDate) : '--'}
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1.5">
                        {cert.cid && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-black dark:text-white font-mono font-bold text-[10px]">
                            CID {cert.cid}
                          </span>
                        )}
                        <span className="text-[11px] text-black/85 dark:text-stone-300">
                          {cert.doctorName ? `Dr(a). ${cert.doctorName}` : (cert.clinic || '--')}
                        </span>
                      </div>
                      {cert.crmCro && (
                        <div className="text-[10px] text-black/70 dark:text-stone-400">
                          CRM/CRO: {cert.crmCro}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(cert)}
                          className="p-1 text-black/70 hover:text-black dark:text-stone-400 dark:hover:text-white hover:bg-blue-200/50 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Atestado"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cert.id)}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 rounded transition cursor-pointer"
                          title="Excluir Atestado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-black/70 dark:text-stone-400 font-medium">
                    Nenhum atestado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastro / Edição de Atestado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="crm-card bg-[#87AFE3] border border-blue-200/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0963cb] text-white">
              <div className="flex items-center space-x-2">
                <FileHeart className="w-4 h-4 text-pink-300" />
                <h3 className="font-bold text-sm">
                  {editingCert ? 'Editar Atestado Médico' : 'Cadastrar Novo Atestado'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4 text-xs bg-[#b0d2ed]">
              
              {/* Colaborador */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Colaborador / Funcionário <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-medium"
                  required
                >
                  <option value="">Selecione um funcionário...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - {emp.contractType || 'CLT'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Tipo de Atestado / Declaração <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-medium"
                    required
                  >
                    <option value="Atestado Médico">Atestado Médico</option>
                    <option value="Atestado Odontológico">Atestado Odontológico</option>
                    <option value="Declaração de Horas">Declaração de Comparecimento / Horas</option>
                    <option value="Acompanhamento Familiar">Acompanhamento Familiar</option>
                    <option value="Licença Maternidade/Paternidade">Licença Maternidade / Paternidade</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">
                    Status de Homologação
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                  >
                    <option value="homologado">Homologado (Abonar)</option>
                    <option value="em_analise">Em Análise pela Coordenação</option>
                    <option value="rejeitado">Rejeitado</option>
                  </select>
                </div>
              </div>

              {/* Card de Período e Duração */}
              <div className="p-3.5 bg-white border border-stone-300 rounded-xl space-y-3 shadow-xs">
                <span className="text-[11px] font-black uppercase text-black block tracking-wider">
                  Período & Duração do Afastamento
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Data Inicial <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleDateChange(e.target.value, endDate)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>

                  {type === 'Declaração de Horas' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Qtd. de Horas Abonadas
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="24"
                        value={hoursCount || ''}
                        onChange={(e) => setHoursCount(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                        placeholder="Ex: 2.5"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Qtd. de Dias Abonados <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={daysCount || ''}
                        onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Previsão de Retorno ao Trabalho
                    </label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>
              </div>

              {/* Dados Médicos e CID */}
              <div className="p-3.5 bg-white border border-stone-300 rounded-xl space-y-3 shadow-xs">
                <span className="text-[11px] font-black uppercase text-black block tracking-wider">
                  Dados do Emissor & CID
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      CID (Opcional/Sigilo)
                    </label>
                    <input
                      type="text"
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      placeholder="Ex: J06, M54.5"
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Nome do Médico / Dentista
                    </label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="Ex: Dr. Roberto Silva"
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      CRM / CRO
                    </label>
                    <input
                      type="text"
                      value={crmCro}
                      onChange={(e) => setCrmCro(e.target.value)}
                      placeholder="Ex: 123456/SP"
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Clínica / Hospital / Unidade de Saúde
                  </label>
                  <input
                    type="text"
                    value={clinic}
                    onChange={(e) => setClinic(e.target.value)}
                    placeholder="Ex: Santa Casa / UBS Central"
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              {/* Anexo & Observações */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Arquivo / Comprovante Anexo (Nome ou Referência)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={attachmentName}
                      onChange={(e) => setAttachmentName(e.target.value)}
                      placeholder="Ex: atestado_medico_092026.pdf ou foto do documento"
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">
                    Observações Internas (RH)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] resize-none"
                    placeholder="Anotações internas sobre entrega do documento..."
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/15">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Salvar Atestado
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
