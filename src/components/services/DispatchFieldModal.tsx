import React, { useState } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Download, 
  MessageSquare, 
  User, 
  Truck, 
  Tractor, 
  Clock, 
  MapPin, 
  Calendar, 
  ExternalLink,
  Phone,
  FileCheck2,
  Copy,
  Check
} from 'lucide-react';
import { ServiceAppointment, Employee, Machinery, CompanyProfile } from '../../types';
import { formatDateBR } from '../../lib/storage';

interface DispatchFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: ServiceAppointment;
  employees?: Employee[];
  machineries?: Machinery[];
  companyProfile?: CompanyProfile;
  onSaveRealData: (appointmentId: string, realData: {
    realStartDate?: string;
    realStartTime?: string;
    realEndDate?: string;
    realEndTime?: string;
    realLoadsCount?: number;
    realHourMeterStart?: number;
    realHourMeterEnd?: number;
    realNotes?: string;
  }) => void;
  onProceedToBilling?: (appointment: ServiceAppointment) => void;
}

export const DispatchFieldModal: React.FC<DispatchFieldModalProps> = ({
  isOpen,
  onClose,
  appointment,
  employees = [],
  machineries = [],
  companyProfile,
  onSaveRealData,
  onProceedToBilling
}) => {
  // Estado para preenchimento dos dados reais trazidos de campo
  const [realForm, setRealForm] = useState({
    realStartDate: appointment.realStartDate || appointment.startDate || new Date().toISOString().split('T')[0],
    realStartTime: appointment.realStartTime || appointment.startTime || '07:30',
    realEndDate: appointment.realEndDate || appointment.endDate || appointment.startDate || new Date().toISOString().split('T')[0],
    realEndTime: appointment.realEndTime || appointment.endTime || '17:00',
    realLoadsCount: appointment.realLoadsCount !== undefined ? String(appointment.realLoadsCount) : '',
    realHourMeterStart: appointment.realHourMeterStart !== undefined ? String(appointment.realHourMeterStart) : '',
    realHourMeterEnd: appointment.realHourMeterEnd !== undefined ? String(appointment.realHourMeterEnd) : '',
    realNotes: appointment.realNotes || '',
  });

  const [activeTab, setActiveTab] = useState<'disparo' | 'retorno'>('disparo');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  if (!isOpen || !appointment) return null;

  // Montar lista de equipe e motoristas envolvidos neste agendamento
  const teamList = appointment.assignedTeam && appointment.assignedTeam.length > 0 
    ? appointment.assignedTeam 
    : [];

  // Se não houver equipe explícita, podemos derivar dos motoristas dos veículos escalados
  const derivedFromVehicles = (appointment.assignedVehicles || [])
    .filter(v => v.driverOrOperatorName)
    .map(v => ({
      employeeId: v.machineryId,
      employeeName: v.driverOrOperatorName || 'Motorista / Operador',
      role: v.category === 'caminhao' ? 'Motorista de Caminhão' : v.category === 'trator' ? 'Operador de Trator' : 'Operador de Máquina',
      assignedVehiclePrefix: v.prefix || v.plateOrSerial
    }));

  const combinedStaff = [...teamList];
  derivedFromVehicles.forEach(d => {
    if (!combinedStaff.some(s => s.employeeName.trim().toLowerCase() === d.employeeName.trim().toLowerCase())) {
      combinedStaff.push(d);
    }
  });

  // Placas dos veículos envolvidos
  const platesList = [
    appointment.primaryMachineryPlate || appointment.primaryMachineryPrefix,
    ...(appointment.assignedVehicles || []).map(v => v.plateOrSerial ? `${v.plateOrSerial} (${v.prefix})` : v.prefix)
  ].filter(Boolean).join(', ') || 'Não informadas';

  const companyName = companyProfile?.tradeName || companyProfile?.corporateName || 'COLAÇA SILAGEM';
  const locationText = appointment.locationCityState || appointment.farmName || 'Campo / Fazenda do Cliente';

  // Obter telefone do funcionário cadastrado no sistema
  const getEmployeePhone = (name: string, empId?: string): string => {
    if (empId) {
      const match = employees.find(e => e.id === empId);
      if (match?.phone) return match.phone;
    }
    const matchByName = employees.find(e => e.name.trim().toLowerCase() === name.trim().toLowerCase());
    return matchByName?.phone || '';
  };

  // Gerar mensagem padrão para cada operador / motorista
  const createWhatsAppMessage = (staffMember: { employeeName: string; role: string; assignedVehiclePrefix?: string }) => {
    const roleText = staffMember.role || 'Operador / Motorista';
    const vehicleText = staffMember.assignedVehiclePrefix ? `\n🚛 *Seu Veículo:* ${staffMember.assignedVehiclePrefix}` : '';
    
    // URL base do formulário de campo
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const formUrl = `${origin}?tab=formularios&agendamento=${encodeURIComponent(appointment.appointmentNumber)}`;

    return `Olá *${staffMember.employeeName}* (${roleText})! 👋\n` +
      `Aqui é da central da *${companyName}*.\n\n` +
      `📋 *ESCALA DE CAMPO - AGENDAMENTO:* ${appointment.appointmentNumber}\n` +
      `👤 *Cliente:* ${appointment.clientName}\n` +
      `📍 *Local / Fazenda:* ${locationText}\n` +
      `📅 *Data Prevista:* ${formatDateBR(appointment.startDate)} às ${appointment.startTime}h\n` +
      `🚜 *Veículo Principal:* ${appointment.primaryMachineryPrefix || 'Forrageira Principal'}\n` +
      `🔢 *Frotas / Placas:* ${platesList}${vehicleText}\n\n` +
      `📝 *Link do Bloco de Lançamento Digital:* \n${formUrl}\n\n` +
      `⚠️ *Atenção:* Por gentileza, ao concluir os trabalhos ou a jornada, retorne pelo WhatsApp os seguintes dados reais:\n` +
      `• *Horário Real de Início:*\n` +
      `• *Horário Real de Término:*\n` +
      `• *Total de Cargas Transportadas:*\n` +
      `• *Horímetro Inicial e Final:*\n\n` +
      `Bom trabalho e segurança na operação! 🌾🚜`;
  };

  const handleOpenWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
      finalPhone = `55${cleanPhone}`;
    }
    const encoded = encodeURIComponent(message);
    const url = finalPhone 
      ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = (message: string, index: number) => {
    navigator.clipboard.writeText(message);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleConfirmAndImportRealData = (e: React.FormEvent) => {
    e.preventDefault();

    const loads = realForm.realLoadsCount !== '' ? Number(realForm.realLoadsCount) : undefined;
    const hStart = realForm.realHourMeterStart !== '' ? Number(realForm.realHourMeterStart) : undefined;
    const hEnd = realForm.realHourMeterEnd !== '' ? Number(realForm.realHourMeterEnd) : undefined;

    onSaveRealData(appointment.id, {
      realStartDate: realForm.realStartDate,
      realStartTime: realForm.realStartTime,
      realEndDate: realForm.realEndDate,
      realEndTime: realForm.realEndTime,
      realLoadsCount: loads,
      realHourMeterStart: hStart,
      realHourMeterEnd: hEnd,
      realNotes: realForm.realNotes,
    });

    setIsSavedFeedback(true);
    setTimeout(() => {
      setIsSavedFeedback(false);
      onClose();
    }, 1200);
  };

  return (
    <div 
      id="modal-dispatch-field"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="bg-stone-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Disparar Escala para a Equipe de Campo</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-black">
                  {appointment.appointmentNumber}
                </span>
              </h3>
              <p className="text-[11px] text-stone-300">
                Cliente: <strong className="text-white">{appointment.clientName}</strong> • {locationText}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Internas: 1. Disparo WhatsApp / 2. Retorno & Importação de Campo */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-3 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('disparo')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'disparo'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>1. Disparo via WhatsApp ({combinedStaff.length} escalados)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retorno')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'retorno'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>2. Retorno & Importar Dados Reais</span>
            {(appointment.realStartTime || appointment.realLoadsCount) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            )}
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
          
          {/* TAB 1: DISPARO WHATSAPP INDIVIDUAL */}
          {activeTab === 'disparo' && (
            <div className="space-y-3">
              {/* Informações Resumidas do Agendamento */}
              <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1.5 text-stone-700 dark:text-stone-300">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold">
                    📅 Previsto: <strong className="text-stone-900 dark:text-stone-100">{formatDateBR(appointment.startDate)} às {appointment.startTime}h</strong>
                  </span>
                  <span className="font-semibold">
                    🌾 Volume: <strong className="text-stone-900 dark:text-stone-100">{appointment.estimatedQuantity} {appointment.areaUnit}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Frotas/Placas:</strong> {platesList}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  Operadores e Motoristas Escalados:
                </span>
                <span className="text-[11px] text-stone-500">
                  Clique no botão verde para enviar diretamente pelo WhatsApp
                </span>
              </div>

              {combinedStaff.length === 0 ? (
                <div className="p-6 text-center text-stone-400 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
                  <User className="w-8 h-8 mx-auto text-stone-300 mb-1" />
                  <p className="font-semibold text-stone-600 dark:text-stone-300">
                    Nenhum operador ou motorista específico foi escalado neste agendamento.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Edite o agendamento para associar a equipe ou utilize o disparo geral.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {combinedStaff.map((staff, idx) => {
                    const phone = getEmployeePhone(staff.employeeName, staff.employeeId);
                    const msg = createWhatsAppMessage(staff);

                    return (
                      <div 
                        key={idx}
                        className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-emerald-300 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-stone-900 dark:text-stone-100 text-xs">
                              {staff.employeeName}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                              {staff.role}
                            </span>
                          </div>

                          <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2">
                            {staff.assignedVehiclePrefix && (
                              <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                                <Truck className="w-3 h-3" />
                                {staff.assignedVehiclePrefix}
                              </span>
                            )}
                            {phone ? (
                              <span className="flex items-center gap-1 font-mono text-[10px] text-stone-600 dark:text-stone-300">
                                <Phone className="w-3 h-3 text-stone-400" />
                                {phone}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 italic">
                                (Sem telefone no cadastro)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação de Disparo */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg, idx)}
                            className="px-2.5 py-1.5 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 hover:bg-stone-100 text-stone-700 dark:text-stone-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Copiar texto da mensagem"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stone-500" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(phone, msg)}
                            className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Abrir WhatsApp para enviar"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-200">
                💡 <strong>Dica Operacional:</strong> A mensagem já vai com o link do bloco digital, endereço do produtor, placas escaladas e as instruções para a equipe responder com os horários de início, término, cargas e horímetros assim que finalizarem.
              </div>
            </div>
          )}

          {/* TAB 2: RETORNO E IMPORTAÇÃO DOS DADOS REAIS DE CAMPO */}
          {activeTab === 'retorno' && (
            <form onSubmit={handleConfirmAndImportRealData} className="space-y-3.5">
              
              <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-1">
                <p className="font-bold text-stone-900 dark:text-stone-100">
                  Conferência do Retorno de Campo (Sem Contagem Automática)
                </p>
                <p className="text-[11px]">
                  Insira abaixo os dados manuais informados pelos operadores via WhatsApp para conferência do escritório. Ao confirmar, o sistema atualizará a linha <strong className="text-emerald-700 dark:text-emerald-400">REAL: [Início] às [Fim]</strong> na tabela.
                </p>
              </div>

              {/* Grid de Horários Reais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Início Real (Data & Hora)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={realForm.realStartDate}
                      onChange={(e) => setRealForm({ ...realForm, realStartDate: e.target.value })}
                      className="w-1/2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                    />
                    <input
                      type="time"
                      value={realForm.realStartTime}
                      onChange={(e) => setRealForm({ ...realForm, realStartTime: e.target.value })}
                      className="w-1/2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-black text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Término Real (Data & Hora)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={realForm.realEndDate}
                      onChange={(e) => setRealForm({ ...realForm, realEndDate: e.target.value })}
                      className="w-1/2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100"
                    />
                    <input
                      type="time"
                      value={realForm.realEndTime}
                      onChange={(e) => setRealForm({ ...realForm, realEndTime: e.target.value })}
                      className="w-1/2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-black text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Cargas e Horímetros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300">
                    Cargas Reais Contadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 48"
                    value={realForm.realLoadsCount}
                    onChange={(e) => setRealForm({ ...realForm, realLoadsCount: e.target.value })}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-black text-stone-900 dark:text-stone-100"
                  />
                  <span className="text-[10px] text-stone-400">Total de viagens de silagem</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300">
                    Horímetro Inicial
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1240.5"
                    value={realForm.realHourMeterStart}
                    onChange={(e) => setRealForm({ ...realForm, realHourMeterStart: e.target.value })}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100"
                  />
                  <span className="text-[10px] text-stone-400">Ao ligar a forrageira</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300">
                    Horímetro Final
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1249.8"
                    value={realForm.realHourMeterEnd}
                    onChange={(e) => setRealForm({ ...realForm, realHourMeterEnd: e.target.value })}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100"
                  />
                  <span className="text-[10px] text-stone-400">Ao encerrar a silagem</span>
                </div>
              </div>

              {/* Observações de Campo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-stone-700 dark:text-stone-300">
                  Observações e Ocorrências de Campo
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Chuva leve das 14h às 14h40; Pneu do caminhão 04 calibrado na fazenda..."
                  value={realForm.realNotes}
                  onChange={(e) => setRealForm({ ...realForm, realNotes: e.target.value })}
                  className="w-full p-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Botões do Rodapé de Importação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  {onProceedToBilling && (
                    <button
                      type="button"
                      onClick={() => {
                        // Salva dados reais antes e abre faturamento
                        onSaveRealData(appointment.id, {
                          realStartDate: realForm.realStartDate,
                          realStartTime: realForm.realStartTime,
                          realEndDate: realForm.realEndDate,
                          realEndTime: realForm.realEndTime,
                          realLoadsCount: realForm.realLoadsCount !== '' ? Number(realForm.realLoadsCount) : undefined,
                          realHourMeterStart: realForm.realHourMeterStart !== '' ? Number(realForm.realHourMeterStart) : undefined,
                          realHourMeterEnd: realForm.realHourMeterEnd !== '' ? Number(realForm.realHourMeterEnd) : undefined,
                          realNotes: realForm.realNotes,
                        });
                        onClose();
                        onProceedToBilling(appointment);
                      }}
                      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Abrir Tela de Faturamento</span>
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
                  >
                    Fechar
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {isSavedFeedback ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Dados Importados com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Confirmar e Importar Dados do Campo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};
