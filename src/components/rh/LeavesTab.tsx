import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  X,
  Stethoscope,
  Activity,
  FileCheck
} from 'lucide-react';
import { Employee, LeaveRecord } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface LeavesTabProps {

  employees: Employee[];
  leaves: LeaveRecord[];
  onSaveLeaves: (leaves: LeaveRecord[]) => void;
}

export const LeavesTab: React.FC<LeavesTabProps> = ({
  employees,
  leaves,
  onSaveLeaves,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [type, setType] = useState<LeaveRecord['type']>('Atestado Médico');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [daysCount, setDaysCount] = useState<number>(1);
  const [cid, setCid] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [status, setStatus] = useState<'ativo' | 'finalizado'>('ativo');
  const [notes, setNotes] = useState('');

  // Filtered
  const filtered = leaves.filter(l => 
    l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.cid && l.cid.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // KPIs
  const activeLeavesCount = leaves.filter(l => l.status === 'ativo').length;
  const atestadosCount = leaves.filter(l => l.type === 'Atestado Médico').length;
  const catCount = leaves.filter(l => l.type === 'Acidente de Trabalho (CAT)').length;
  const inssCount = leaves.filter(l => l.type === 'Auxílio Doença / INSS').length;

  const handleOpenModal = (leave?: LeaveRecord) => {
    if (leave) {
      setEditingLeave(leave);
      setSelectedEmployeeId(leave.employeeId);
      setType(leave.type);
      setStartDate(leave.startDate);
      setEndDate(leave.endDate || '');
      setExpectedReturnDate(leave.expectedReturnDate || '');
      setDaysCount(leave.daysCount || 1);
      setCid(leave.cid || '');
      setDoctorName(leave.doctorName || '');
      setStatus(leave.status);
      setNotes(leave.notes || '');
    } else {
      setEditingLeave(null);
      const firstActive = employees.find(e => e.status === 'ativo');
      setSelectedEmployeeId(firstActive ? firstActive.id : '');
      setType('Atestado Médico');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setExpectedReturnDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setDaysCount(3);
      setCid('');
      setDoctorName('');
      setStatus('ativo');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    if (editingLeave) {
      const updated = leaves.map(l => l.id === editingLeave.id ? {
        ...l,
        employeeId: emp.id,
        employeeName: emp.name,
        type,
        startDate,
        endDate: status === 'finalizado' ? (endDate || new Date().toISOString().split('T')[0]) : endDate,
        expectedReturnDate,
        actualReturnDate: status === 'finalizado' ? new Date().toISOString().split('T')[0] : undefined,
        daysCount,
        cid,
        doctorName,
        status,
        notes,
      } : l);
      onSaveLeaves(updated);
    } else {
      const newLeave: LeaveRecord = {
        id: `leave_${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        type,
        startDate,
        endDate,
        expectedReturnDate,
        daysCount,
        cid,
        doctorName,
        status,
        notes,
        createdAt: new Date().toISOString(),
      };
      onSaveLeaves([newLeave, ...leaves]);
    }
    setIsModalOpen(false);
  };

  const handleToggleStatus = (id: string, currentStatus: 'ativo' | 'finalizado') => {
    const nextStatus = currentStatus === 'ativo' ? 'finalizado' : 'ativo';
    onSaveLeaves(leaves.map(l => l.id === id ? {
      ...l,
      status: nextStatus,
      actualReturnDate: nextStatus === 'finalizado' ? new Date().toISOString().split('T')[0] : undefined,
    } : l));
  };

  const handleDelete = async (id: string) => {
    const item = leaves.find(l => l.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Registro de Afastamento',
      message: item?.employeeName
        ? `Deseja realmente excluir o afastamento (${item.type}) de "${item.employeeName}"?`
        : 'Deseja realmente excluir este registro de afastamento?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveLeaves(leaves.filter(l => l.id !== id));
    }
  };


  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Top Header & Actions */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-black dark:text-white">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-100/70 dark:bg-stone-800 border border-blue-200/80 dark:border-stone-700 text-black dark:text-white">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">
              Afastamentos, Atestados e Licenças
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Controle médico, CAT, licenças e previsões de retorno
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Afastamento</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-rose-400 block uppercase">Afastamentos Ativos</span>
          <span className="text-base font-black text-black dark:text-rose-400 font-['Outfit']">
            {activeLeavesCount} colaborador(es)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Atestados Médicos</span>
          <span className="text-base font-black text-black dark:text-white font-['Outfit']">
            {atestadosCount} registro(s)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-amber-400 block uppercase">Acidente Trabalho (CAT)</span>
          <span className="text-base font-black text-black dark:text-amber-400 font-['Outfit']">
            {catCount} registro(s)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-sky-400 block uppercase">Auxílio INSS</span>
          <span className="text-base font-black text-black dark:text-sky-400 font-['Outfit']">
            {inssCount} registro(s)
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl px-3 py-2 shadow-xs flex items-center justify-between text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-black dark:text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por colaborador, tipo ou CID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-blue-300 dark:border-stone-700 rounded-lg bg-blue-100/50 dark:bg-stone-800 text-black dark:text-white placeholder-black/60 dark:placeholder-stone-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <span className="text-xs text-black/85 dark:text-stone-300 font-bold hidden sm:block">
          {filtered.length} afastamento(s)
        </span>
      </div>

      {/* Table */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Motivo / Tipo</th>
                <th className="py-2.5 px-3">Início</th>
                <th className="py-2.5 px-3">Previsão / Retorno</th>
                <th className="py-2.5 px-3 text-center">Dias</th>
                <th className="py-2.5 px-3">CID / Médico</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition border ${
                          item.status === 'ativo'
                            ? 'bg-rose-100 border-rose-300 text-rose-900'
                            : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                        }`}
                      >
                        {item.status === 'ativo' ? (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            <span>Afastado</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Finalizado</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white text-xs">
                        {item.employeeName}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium truncate max-w-xs">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 font-bold text-black dark:text-white text-xs">
                      {item.type}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs whitespace-nowrap">
                      {formatDateBR(item.startDate)}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs whitespace-nowrap">
                      {item.actualReturnDate ? (
                        <span className="text-black dark:text-emerald-400 font-bold">Retornou: {formatDateBR(item.actualReturnDate)}</span>
                      ) : item.expectedReturnDate ? (
                        <span>Prev: {formatDateBR(item.expectedReturnDate)}</span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="py-2 px-3 text-center font-bold text-xs text-black dark:text-white">
                      {item.daysCount}d
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs">
                      {item.cid && <span className="font-mono font-bold bg-blue-100/70 dark:bg-stone-800 border border-blue-300 dark:border-stone-700 px-1 py-0.5 rounded text-[10px] mr-1 text-black dark:text-white">{item.cid}</span>}
                      {item.doctorName && <span>{item.doctorName}</span>}
                      {!item.cid && !item.doctorName && <span>-</span>}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black/70 dark:text-stone-400 hover:text-black dark:hover:text-[#009688] hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Afastamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir Afastamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400 text-xs">
                    Nenhum registro de afastamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Afastamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#b0d2ed] border border-[#0963cb]/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header com azul padrão #0963cb e texto/ícone em branco #ffffff */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0963cb] text-white">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {editingLeave ? 'Editar Registro de Afastamento' : 'Registrar Novo Afastamento / Atestado'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
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
                  <option value="">Selecione um colaborador...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Afastamento */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Motivo / Tipo de Afastamento <span className="text-rose-600">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                  required
                >
                  <option value="Atestado Médico">Atestado Médico (Geral)</option>
                  <option value="Acidente de Trabalho (CAT)">Acidente de Trabalho (CAT Rural / Silagem)</option>
                  <option value="Auxílio Doença / INSS">Auxílio Doença / INSS (&gt; 15 dias)</option>
                  <option value="Licença Maternidade/Paternidade">Licença Maternidade / Paternidade</option>
                  <option value="Licença Não Remunerada">Licença Não Remunerada / Pessoal</option>
                  <option value="Outro">Outro Afastamento Legal</option>
                </select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Data Início <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-black mb-1">
                    Previsão Retorno
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-black mb-1">
                    Qtd. Dias
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={daysCount}
                    onChange={(e) => setDaysCount(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              {/* CID & Médico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Código CID (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cid}
                    onChange={(e) => setCid(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black uppercase font-mono outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-black mb-1">
                    Médico / CRM (Opcional)
                  </label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Situação do Afastamento
                </label>
                <div className="flex items-center space-x-3 mt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'ativo'}
                      onChange={() => setStatus('ativo')}
                      className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                    />
                    <span className="font-bold text-rose-700">Afastado (Ativo)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'finalizado'}
                      onChange={() => setStatus('finalizado')}
                      className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                    />
                    <span className="font-bold text-emerald-700">Retornou ao Trabalho (Finalizado)</span>
                  </label>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] resize-none"
                />
              </div>

              {/* Action Buttons */}
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
                  className="px-5 py-2 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Salvar Afastamento
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
