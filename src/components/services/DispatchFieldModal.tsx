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
    if (!combinedStaff.some(s => String(s.employeeName ?? '').trim().toLowerCase() === String(d.employeeName ?? '').trim().toLowerCase())) {
      combinedStaff.push(d);
    }
  });

  // Placas dos veículos envolvidos
  const platesList = [
    appointment.primaryMachineryPlate || appointment.primaryMachineryPrefix,
    ...(appointment.assignedVehicles || []).map(v => v.plateOrSerial ? `${v.plateOrSerial} (${v.prefix})` : v.prefix)
  ].filter(Boolean).join(', ') || 'Não informadas';

  const companyName = companyProfile?.tradeName || companyProfile?.corporateName || 'Nossa Empresa';
  const locationText = appointment.locationCityState || appointment.farmName || 'Campo / Fazenda do Cliente';

  // Obter telefone do funcionário cadastrado no sistema
  const getEmployeePhone = (name: string, empId?: string): string => {
    if (empId) {
      const match = employees.find(e => e.id === empId);
      if (match?.phone) return match.phone;
    }
    const matchByName = employees.find(e => String(e.name ?? '').trim().toLowerCase() === String(name ?? '').trim().toLowerCase());
    return matchByName?.phone || '';
  };

  // Obter URL base do sistema para o formulário de campo externo
  const getBaseAppUrl = (): string => {
    // 1. Variável de ambiente pública (se configurada para o domínio de produção)
    const envUrl = (import.meta as any).env?.VITE_PUBLIC_APP_URL || (import.meta as any).env?.VITE_APP_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim().replace(/\/$/, '');
    }

    // 2. Baseada no domínio atual do navegador (window.location.origin + pathname)
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin || '';
      const pathname = window.location.pathname || '';
      return `${origin}${pathname}`.replace(/\/$/, '');
    }

    return '';
  };

  // Gerar mensagem padrão para cada operador / motorista
  const createWhatsAppMessage = (staffMember: { employeeName: string; role: string; assignedVehiclePrefix?: string }) => {
    const roleText = staffMember.role || 'Operador / Motorista';
    const vehicleText = staffMember.assignedVehiclePrefix ? `\n🚛 *Seu Veículo:* ${staffMember.assignedVehiclePrefix}` : '';
    
    // URL base do formulário de campo preservando estritamente a rota, o cargo e o agendamento
    const baseUrl = getBaseAppUrl();
    let cargoParam = 'forrageira';
    const rLower = (staffMember.role || '').toLowerCase();
    if (rLower.includes('trator') || rLower.includes('compacta')) {
      cargoParam = 'trator';
    } else if (rLower.includes('caminh') || rLower.includes('motorista') || rLower.includes('transporte')) {
      cargoParam = 'caminhao';
    } else {
      cargoParam = 'forrageira';
    }
    const queryParam = `?tab=formularios&cargo=${cargoParam}&agendamento=${encodeURIComponent(appointment.appointmentNumber)}`;
    const formUrl = baseUrl ? `${baseUrl}${queryParam}` : queryParam;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black">
        
        {/* Cabeçalho do Modal */}
        <div className="border-b border-black bg-[#cad4e6] text-black px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e0e6f1] text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
              <MessageSquare className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black flex items-center gap-2">
                <span>DISPARAR ESCALA PARA A EQUIPE DE CAMPO</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white text-black font-bold border border-black shadow-2xs">
                  {appointment.appointmentNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-800 font-medium mt-0.5">
                Cliente: <strong className="text-black font-bold">{appointment.clientName}</strong> • {locationText}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-[#e0e6f1] border border-transparent hover:border-black transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Abas Internas */}
        <div className="flex border-b border-black bg-[#cad4e6] px-4 py-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('disparo')}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'disparo'
                ? 'bg-white text-black font-bold border border-black shadow-2xs'
                : 'bg-[#e0e6f1] text-black border border-black/40 hover:bg-white/70 font-semibold'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>1. Disparo via WhatsApp ({combinedStaff.length} escalados)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retorno')}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'retorno'
                ? 'bg-white text-black font-bold border border-black shadow-2xs'
                : 'bg-[#e0e6f1] text-black border border-black/40 hover:bg-white/70 font-semibold'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>2. Retorno & Importar Dados Reais</span>
            {(appointment.realStartTime || appointment.realLoadsCount) && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
            )}
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0 bg-[#cad4e6] text-xs text-black">
          
          {/* TAB 1: DISPARO WHATSAPP INDIVIDUAL */}
          {activeTab === 'disparo' && (
            <div className="space-y-3.5">
              {/* Informações Resumidas do Agendamento */}
              <div className="p-3.5 bg-[#e0e6f1] border border-black rounded-xl space-y-1.5 text-black shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold">
                    📅 Previsto: <strong className="text-black">{formatDateBR(appointment.startDate)} às {appointment.startTime}h</strong>
                  </span>
                  <span className="font-semibold">
                    🌾 Volume: <strong className="text-black">{appointment.estimatedQuantity} {appointment.areaUnit}</strong>
                  </span>
                </div>
                <div className="text-xs text-slate-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span><strong>Frotas/Placas:</strong> {platesList}</span>
                </div>
              </div>

              <div className="bg-[#e0e6f1] border border-black rounded-xl p-3.5 sm:p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 pb-2">
                  <span className="font-bold text-black uppercase tracking-wide">
                    Operadores e Motoristas Escalados
                  </span>
                  <span className="text-[11px] text-slate-800 font-medium">
                    Clique no botão verde para enviar diretamente pelo WhatsApp
                  </span>
                </div>

                {combinedStaff.length === 0 ? (
                  <div className="p-6 text-center text-slate-700 bg-white rounded-xl border border-dashed border-black/40">
                    <User className="w-8 h-8 mx-auto text-slate-500 mb-1" />
                    <p className="font-bold text-black">
                      Nenhum operador ou motorista específico foi escalado neste agendamento.
                    </p>
                    <p className="text-[11px] text-slate-700 mt-1">
                      Edite o agendamento para associar a equipe ou utilize o disparo geral.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {combinedStaff.map((staff, idx) => {
                      const phone = getEmployeePhone(staff.employeeName, staff.employeeId);
                      const msg = createWhatsAppMessage(staff);

                      return (
                        <div 
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-black text-xs">
                                {staff.employeeName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e0e6f1] border border-black/40 text-black">
                                {staff.role}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-800 flex items-center gap-2">
                              {staff.assignedVehiclePrefix && (
                                <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-800 font-bold">
                                  <Truck className="w-3 h-3" />
                                  {staff.assignedVehiclePrefix}
                                </span>
                              )}
                              {phone ? (
                                <span className="flex items-center gap-1 font-mono text-[10px] text-black font-semibold">
                                  <Phone className="w-3 h-3 text-slate-700" />
                                  {phone}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-800 font-semibold italic">
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
                              className="px-2.5 py-1.5 bg-white border border-black hover:bg-gray-100 text-black rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Copiar texto da mensagem"
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                                  <span className="text-emerald-700">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-black" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenWhatsApp(phone, msg)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
              </div>

              <div className="p-3 bg-[#e0e6f1] border border-black rounded-xl text-[11px] text-black">
                💡 <strong>Dica Operacional:</strong> A mensagem já vai com o link do bloco digital, endereço do produtor, placas escaladas e as instruções para a equipe responder com os horários de início, término, cargas e horímetros assim que finalizarem.
              </div>
            </div>
          )}

          {/* TAB 2: RETORNO E IMPORTAÇÃO DOS DADOS REAIS DE CAMPO */}
          {activeTab === 'retorno' && (
            <form id="dispatch-retorno-form" onSubmit={handleConfirmAndImportRealData} className="space-y-4">
              
              <div className="p-3.5 bg-[#e0e6f1] rounded-xl border border-black text-xs text-black space-y-1">
                <p className="font-bold text-black uppercase">
                  Conferência do Retorno de Campo (Sem Contagem Automática)
                </p>
                <p className="text-[11px] text-slate-900">
                  Insira abaixo os dados manuais informados pelos operadores via WhatsApp para conferência do escritório. Ao confirmar, o sistema atualizará a linha <strong className="text-emerald-800">REAL: [Início] às [Fim]</strong> na tabela.
                </p>
              </div>

              {/* Grid de Horários Reais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-[#e0e6f1] rounded-xl border border-black">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-black uppercase tracking-wider">
                    Início Real (Data & Hora)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={realForm.realStartDate}
                      onChange={(e) => setRealForm({ ...realForm, realStartDate: e.target.value })}
                      className="w-1/2 p-2 bg-white border border-black rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <input
                      type="time"
                      value={realForm.realStartTime}
                      onChange={(e) => setRealForm({ ...realForm, realStartTime: e.target.value })}
                      className="w-1/2 p-2 bg-white border border-black rounded-lg text-xs font-black text-emerald-800 focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-black uppercase tracking-wider">
                    Término Real (Data & Hora)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={realForm.realEndDate}
                      onChange={(e) => setRealForm({ ...realForm, realEndDate: e.target.value })}
                      className="w-1/2 p-2 bg-white border border-black rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <input
                      type="time"
                      value={realForm.realEndTime}
                      onChange={(e) => setRealForm({ ...realForm, realEndTime: e.target.value })}
                      className="w-1/2 p-2 bg-white border border-black rounded-lg text-xs font-black text-emerald-800 focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>
              </div>

              {/* Cargas e Horímetros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-[#e0e6f1] rounded-xl border border-black">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-black uppercase">
                    Cargas Reais Contadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 48"
                    value={realForm.realLoadsCount}
                    onChange={(e) => setRealForm({ ...realForm, realLoadsCount: e.target.value })}
                    className="w-full p-2 bg-white border border-black rounded-lg text-xs font-black text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="text-[10px] text-slate-800 font-medium">Total de viagens de silagem</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-black uppercase">
                    Horímetro Inicial
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1240.5"
                    value={realForm.realHourMeterStart}
                    onChange={(e) => setRealForm({ ...realForm, realHourMeterStart: e.target.value })}
                    className="w-full p-2 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="text-[10px] text-slate-800 font-medium">Ao ligar a forrageira</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-black uppercase">
                    Horímetro Final
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1249.8"
                    value={realForm.realHourMeterEnd}
                    onChange={(e) => setRealForm({ ...realForm, realHourMeterEnd: e.target.value })}
                    className="w-full p-2 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="text-[10px] text-slate-800 font-medium">Ao encerrar a silagem</span>
                </div>
              </div>

              {/* Observações de Campo */}
              <div className="p-3.5 bg-[#e0e6f1] rounded-xl border border-black space-y-1">
                <label className="block text-[11px] font-bold text-black uppercase">
                  Observações e Ocorrências de Campo
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Chuva leve das 14h às 14h40; Pneu do caminhão 04 calibrado na fazenda..."
                  value={realForm.realNotes}
                  onChange={(e) => setRealForm({ ...realForm, realNotes: e.target.value })}
                  className="w-full p-2 bg-white border border-black rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </form>
          )}

        </div>

        {/* Rodapé Fixo */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-black bg-[#cad4e6] shrink-0">
          <div className="flex items-center gap-2">
            {activeTab === 'retorno' && onProceedToBilling && (
              <button
                type="button"
                onClick={() => {
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
                className="px-3.5 py-2 bg-white hover:bg-gray-100 text-black border border-black rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Abrir Tela de Faturamento</span>
                <ExternalLink className="w-3.5 h-3.5 text-black" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-black bg-white hover:bg-gray-100 border border-black rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>

            {activeTab === 'retorno' && (
              <button
                type="submit"
                form="dispatch-retorno-form"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold border border-emerald-800 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
