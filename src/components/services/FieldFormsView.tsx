import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  RotateCcw, 
  Check, 
  Fuel, 
  Clock, 
  Truck, 
  Tractor, 
  Scissors,
  Save,
  Phone,
  AlertTriangle,
  X,
  ExternalLink,
  Sparkles,
  Send,
  CheckCircle,
  MessageSquare
} from 'lucide-react';
import { CompanyProfile, Machinery, Employee, Client, ServiceAppointment } from '../../types';
import { findAppointmentByIdOrNumber, DEFAULT_INITIAL_APPOINTMENTS } from '../../lib/defaultAppointments';
import { addStoredFieldSubmission, updateAppointmentFieldReturn } from '../../lib/storage';

interface FieldFormsViewProps {
  companyProfile?: CompanyProfile;
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  isExternalOperatorMode?: boolean;
  onExitOperatorMode?: () => void;
  initialAppointmentId?: string;
}

export const FieldFormsView: React.FC<FieldFormsViewProps> = ({
  companyProfile,
  machineries = [],
  employees = [],
  clients = [],
  isExternalOperatorMode = false,
  onExitOperatorMode,
  initialAppointmentId,
}) => {
  // Leitor de Parâmetro da URL para Agendamento
  const getAgendamentoFromUrl = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let ag = searchParams.get('agendamento') || searchParams.get('agenda') || '';
      if (ag) return ag.trim();

      if (window.location.hash.includes('agendamento=')) {
        const hashPart = window.location.hash.includes('?') 
          ? window.location.hash.split('?')[1] 
          : window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hashPart);
        ag = hashParams.get('agendamento') || '';
        if (ag) return ag.trim();
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  };

  // Leitor estrito do Cargo da URL (cargo=forrageira, cargo=trator, cargo=caminhao)
  const getCargoFromUrl = (): 'corte' | 'compactacao' | 'cargas' | null => {
    if (typeof window === 'undefined') return null;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let cargo = (searchParams.get('cargo') || searchParams.get('funcao') || searchParams.get('subform') || searchParams.get('form') || searchParams.get('subtab') || '').toLowerCase().trim();
      if (!cargo && window.location.hash.includes('cargo=')) {
        const hashPart = window.location.hash.includes('?') 
          ? window.location.hash.split('?')[1] 
          : window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hashPart);
        cargo = (hashParams.get('cargo') || '').toLowerCase().trim();
      }
      if (cargo === 'forrageira' || cargo === 'corte' || cargo === 'colheitadeira' || cargo === 'operador') return 'corte';
      if (cargo === 'trator' || cargo === 'compactacao' || cargo === 'compactador') return 'compactacao';
      if (cargo === 'caminhao' || cargo === 'caminhoes' || cargo === 'cargas' || cargo === 'motorista') return 'cargas';
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const detectedCargo = getCargoFromUrl();
  const isOperatorModeActive = Boolean(isExternalOperatorMode || getAgendamentoFromUrl());

  // Estado interno para modo administrativo de escritório
  const [internalActiveTab, setInternalActiveTab] = useState<'corte' | 'compactacao' | 'cargas'>(() => {
    return detectedCargo || 'corte';
  });

  // No modo operador externo, a aba fica ESTRITAMENTE travada no cargo correspondente
  const activeFormTab: 'corte' | 'compactacao' | 'cargas' = isOperatorModeActive
    ? (detectedCargo || 'corte')
    : internalActiveTab;

  const setActiveFormTab = (tab: 'corte' | 'compactacao' | 'cargas') => {
    if (!isOperatorModeActive) {
      setInternalActiveTab(tab);
    }
  };

  // Agendamento vinculado
  const [loadedAppointment, setLoadedAppointment] = useState<ServiceAppointment | null>(() => {
    const targetId = initialAppointmentId || getAgendamentoFromUrl();
    if (targetId) {
      return findAppointmentByIdOrNumber(targetId) || null;
    }
    return null;
  });

  // Cabeçalho da Empresa Reativo
  const companyLogo = companyProfile?.logoUrl;
  const companyCnpj = companyProfile?.cnpjCpf || '';
  const companyTradeName = companyProfile?.tradeName || companyProfile?.corporateName || '';
  const companyAddress = companyProfile?.address 
    ? `${companyProfile.address}${companyProfile.city ? ` - ${companyProfile.city}` : ''}${companyProfile.state ? ` - ${companyProfile.state}` : ''}`
    : (companyProfile?.city ? `${companyProfile.city}${companyProfile.state ? ` - ${companyProfile.state}` : ''}` : '');
  const companyPhone = companyProfile?.phone || '';

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 1: PEDIDO DE CORTE (Operador da Forrageira)
  // -------------------------------------------------------------
  const [f1Data, setF1Data] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    cliente: '',
    endereco: '',
    cidade: '',
    uf: 'PR',
    cnpjCpf: '',
    inscrEst: '',
    condPagto: 'À Vista / Safra',
    fone: '',
    numMaquina: '',
    operador: '',
    hectares: '',
    valorHaHr: '',
    valorTotalCorte: '',
    hrT: '',
    hrM: '',
    caminhoes: [
      { id: 1, placa: '', motorista: '', cargas: '', km: '' },
      { id: 2, placa: '', motorista: '', cargas: '', km: '' },
      { id: 3, placa: '', motorista: '', cargas: '', km: '' },
      { id: 4, placa: '', motorista: '', cargas: '', km: '' },
      { id: 5, placa: '', motorista: '', cargas: '', km: '' },
    ],
    valorTotalCaminhoes: '',
    tratorNum: '',
    tratorValorHr: '',
    tratorValorTotal: '',
    tratorOperador: '',
    tratorTotalHoras: '',
    obs: '',
    totalGeral: '',
  });

  // Atualização de caminhões no Form 1
  const handleTruckChange = (index: number, field: string, value: string) => {
    const updated = [...f1Data.caminhoes];
    updated[index] = { ...updated[index], [field]: value };
    setF1Data(prev => ({ ...prev, caminhoes: updated }));
  };

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 2: CONTROLE COMPACTAÇÃO (Operador do Trator)
  // -------------------------------------------------------------
  const [f2Data, setF2Data] = useState({
    dataInicial: new Date().toLocaleDateString('pt-BR'),
    dataFinal: '',
    cliente: '',
    numTrator: '',
    operadorTrator: '',
    numMaquina: '',
    operadorMaquina: '',
    hrInicial: '',
    hrFinal: '',
    totalHr: '',
    valorHr: '',
    valorTotal: '',
    // Seção Acoplada de Abastecimento
    abastData: new Date().toLocaleDateString('pt-BR'),
    abastPosto: '',
    abastLitros: '',
    abastValorLitro: '',
    abastHr: '',
    abastValorTotal: '',
    abastObs: '',
  });

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 3: CONTROLE DE CARGAS (Demais Veículos / Caminhões)
  // -------------------------------------------------------------
  const [f3Data, setF3Data] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    cliente: '',
    endereco: '',
    placa: '',
    motorista: '',
    maquina: '',
    // Mapa: { [numeroCarga]: '14:32' }
    loadsRecord: {} as Record<number, string>,
    qtdeCargasLonge: '',
    km: '',
    // Seção Acoplada de Abastecimento
    abastPosto: '',
    abastLitros: '',
    abastValorPorLitro: '',
    abastKm: '',
    abastValorTotal: '',
    abastHr: '',
    abastObs: '',
  });

  // Função central de aplicação do Agendamento aos Formulários
  const applyAppointmentData = (appt: ServiceAppointment) => {
    // 1. Data formatada DD/MM/AAAA
    const formatDateToBR = (dateStr?: string): string => {
      if (!dateStr) return new Date().toLocaleDateString('pt-BR');
      if (dateStr.includes('/')) return dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };
    const dataFormatada = formatDateToBR(appt.startDate);

    // 2. Cliente e Dados Cadastrais
    const matchingClient = clients.find(c => 
      (appt.clientId && c.id === appt.clientId) || 
      (c.name && c.name.toLowerCase().trim() === appt.clientName?.toLowerCase().trim())
    );
    const clientName = appt.clientName || matchingClient?.name || '';

    // 3. Endereço / Fazenda / Linha
    const endereco = appt.farmName || matchingClient?.address || matchingClient?.farmName || appt.locationCityState || '';

    // 4. Cidade e Estado (UF)
    let cidade = matchingClient?.city || '';
    let uf = matchingClient?.state || 'PR';
    if (appt.locationCityState) {
      const parts = appt.locationCityState.split(/[-/]/);
      if (parts.length >= 2) {
        cidade = parts[0].trim();
        uf = parts[1].trim().toUpperCase();
      } else if (!cidade) {
        cidade = appt.locationCityState.trim();
      }
    }

    // 5. Telefone / Contato
    const fone = appt.contactPhone || matchingClient?.phone || '';
    const cnpjCpf = matchingClient?.cpfCnpj || '';
    const inscrEst = matchingClient?.stateRegistration || '';

    // 6. Máquina Principal (Forrageira ou Colheitadeira) e Operador
    const nomeMaquina = appt.primaryMachineryPrefix || appt.primaryMachineryModel || appt.primaryMachineryPlate || 'Forrageira 01';
    const forageOp = appt.assignedTeam?.find(t => 
      t.role?.toLowerCase().includes('forrageira') || 
      t.role?.toLowerCase().includes('principal') || 
      t.role?.toLowerCase().includes('colheitadeira') ||
      t.role?.toLowerCase().includes('maquina')
    );
    const operadorMaquina = forageOp?.employeeName || (appt.assignedTeam && appt.assignedTeam.length > 0 ? appt.assignedTeam[0].employeeName : '');

    // 7. Trator de Compactação e seu Operador
    const tractorVehicle = (appt.assignedVehicles || []).find(v => 
      v.category === 'trator' || 
      v.prefix?.toLowerCase().includes('trator') || 
      v.prefix?.toLowerCase().includes('tr-') ||
      v.model?.toLowerCase().includes('trator')
    );
    const tratorNum = tractorVehicle?.prefix || tractorVehicle?.plateOrSerial || tractorVehicle?.model || '';
    const tractorOpTeam = appt.assignedTeam?.find(t => 
      t.role?.toLowerCase().includes('trator') || 
      t.role?.toLowerCase().includes('compactad') ||
      (tractorVehicle && t.assignedVehiclePrefix && tractorVehicle.prefix.includes(t.assignedVehiclePrefix))
    );
    const operadorTrator = tractorVehicle?.driverOrOperatorName || tractorOpTeam?.employeeName || '';

    // 8. Lista de Caminhões / Frotas de apoio escalados
    const truckVehicles = (appt.assignedVehicles || []).filter(v => 
      v.category === 'caminhao' || 
      (!v.category && !v.prefix?.toLowerCase().includes('trator'))
    );

    const preenchimentoCaminhoes = [1, 2, 3, 4, 5].map((id, index) => {
      const truck = truckVehicles[index];
      if (truck) {
        let driver = truck.driverOrOperatorName || '';
        if (!driver) {
          const teamMember = appt.assignedTeam?.find(t => 
            t.assignedVehiclePrefix && truck.prefix?.includes(t.assignedVehiclePrefix)
          );
          driver = teamMember?.employeeName || '';
        }
        return {
          id,
          placa: truck.plateOrSerial || truck.prefix || '',
          motorista: driver,
          cargas: '',
          km: '',
        };
      }
      return { id, placa: '', motorista: '', cargas: '', km: '' };
    });

    const hectaresStr = appt.estimatedQuantity ? `${appt.estimatedQuantity} ${appt.areaUnit === 'alqueires' ? 'alq' : 'ha'}` : '';

    // Preenche Form 1: Pedido de Corte
    setF1Data(prev => ({
      ...prev,
      data: dataFormatada,
      cliente: clientName,
      endereco: endereco,
      cidade: cidade,
      uf: uf,
      cnpjCpf: cnpjCpf || prev.cnpjCpf,
      inscrEst: inscrEst || prev.inscrEst,
      fone: fone || prev.fone,
      numMaquina: nomeMaquina,
      operador: operadorMaquina,
      hectares: hectaresStr || prev.hectares,
      caminhoes: preenchimentoCaminhoes,
      tratorNum: tratorNum,
      tratorOperador: operadorTrator,
      obs: appt.fieldNotes || prev.obs,
    }));

    // Preenche Form 2: Controle de Compactação
    setF2Data(prev => ({
      ...prev,
      dataInicial: dataFormatada,
      cliente: clientName,
      numTrator: tratorNum || prev.numTrator,
      operadorTrator: operadorTrator || prev.operadorTrator,
      numMaquina: nomeMaquina || prev.numMaquina,
      operadorMaquina: operadorMaquina || prev.operadorMaquina,
    }));

    // Preenche Form 3: Controle de Cargas
    const primeiroCaminhao = truckVehicles[0];
    let primeiroMotorista = primeiroCaminhao?.driverOrOperatorName || '';
    if (!primeiroMotorista && primeiroCaminhao) {
      const teamMember = appt.assignedTeam?.find(t => 
        t.assignedVehiclePrefix && primeiroCaminhao.prefix?.includes(t.assignedVehiclePrefix)
      );
      primeiroMotorista = teamMember?.employeeName || '';
    }

    setF3Data(prev => ({
      ...prev,
      data: dataFormatada,
      cliente: clientName,
      endereco: endereco,
      maquina: nomeMaquina,
      placa: primeiroCaminhao?.plateOrSerial || primeiroCaminhao?.prefix || prev.placa,
      motorista: primeiroMotorista || prev.motorista,
    }));
  };

  // Efeito de inicialização e monitoramento do agendamento
  useEffect(() => {
    const targetId = initialAppointmentId || getAgendamentoFromUrl();
    if (targetId) {
      const appt = findAppointmentByIdOrNumber(targetId);
      if (appt) {
        setLoadedAppointment(appt);
        applyAppointmentData(appt);
      }
    }
  }, [initialAppointmentId, clients]);

  // Lista de caminhões da escala para seleção rápida no Form 3
  const scheduledTrucks = useMemo(() => {
    if (!loadedAppointment?.assignedVehicles) return [];
    return loadedAppointment.assignedVehicles.filter(v => 
      v.category === 'caminhao' || (!v.category && !v.prefix?.toLowerCase().includes('trator'))
    );
  }, [loadedAppointment]);

  // Estado para confirmação de desmarcação de carga
  const [loadToUncheck, setLoadToUncheck] = useState<{ num: number; time: string } | null>(null);

  // Clique no botão de carga (Marcar direto ou abrir modal de confirmação para desmarcar)
  const handleLoadClick = (num: number) => {
    const existingTime = f3Data.loadsRecord[num];

    if (existingTime) {
      // Já está marcada: abre o popup/modal de confirmação
      setLoadToUncheck({ num, time: existingTime });
    } else {
      // Disponível: registra a hora atual no padrão HH:mm
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      setF3Data(prev => ({
        ...prev,
        loadsRecord: {
          ...prev.loadsRecord,
          [num]: currentTime,
        },
      }));
    }
  };

  // Confirmar a desmarcação da carga no modal
  const confirmUncheckLoad = () => {
    if (!loadToUncheck) return;
    const targetNum = loadToUncheck.num;

    setF3Data(prev => {
      const updated = { ...prev.loadsRecord };
      delete updated[targetNum];
      return { ...prev, loadsRecord: updated };
    });

    setLoadToUncheck(null);
  };

  const cancelUncheckLoad = () => {
    setLoadToUncheck(null);
  };

  const handlePrint = () => {
    window.print();
  };

  // Estados de confirmação e sucesso do envio de volta
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [sentWhatsAppUrl, setSentWhatsAppUrl] = useState<string>('');

  // -------------------------------------------------------------
  // FUNÇÃO: ENVIAR DE VOLTA (Retorno do Operador para a Empresa)
  // -------------------------------------------------------------
  const handleEnviarDeVolta = () => {
    // Telefone da empresa configurado no perfil ou padrão
    const rawCompanyPhone = companyProfile?.phone || companyPhone || '';
    const cleanCompanyPhone = rawCompanyPhone.replace(/\D/g, '');
    let targetPhone = cleanCompanyPhone;
    if (cleanCompanyPhone.length >= 10 && !cleanCompanyPhone.startsWith('55')) {
      targetPhone = `55${cleanCompanyPhone}`;
    }

    let summaryText = '';
    let missingWarning = '';
    const operatorName = f1Data.operador || f2Data.operadorTrator || f3Data.motorista || 'Operador de Campo';
    const clientName = f1Data.cliente || f2Data.cliente || f3Data.cliente || loadedAppointment?.clientName || 'Cliente';
    const appointmentNum = loadedAppointment?.appointmentNumber || 'N/A';

    // 1. Validação e Formatação por Cargo / Formulário
    if (activeFormTab === 'corte') {
      const hasHectares = Boolean(f1Data.hectares && f1Data.hectares.trim());
      const hasHr = Boolean((f1Data.hrM && f1Data.hrM.trim()) || (f1Data.hrT && f1Data.hrT.trim()));
      const hasCargas = f1Data.caminhoes.some(c => Boolean(c.cargas && c.cargas.trim() && c.cargas !== '0'));
      const hasTratorHr = Boolean(f1Data.tratorTotalHoras && f1Data.tratorTotalHoras.trim());

      if (!hasHectares && !hasHr && !hasCargas && !hasTratorHr) {
        missingWarning = 'Atenção: Os campos de Hectares, Horímetro ou Cargas dos caminhões ainda não foram preenchidos.';
      }

      const caminhoesComCarga = f1Data.caminhoes.filter(c => c.placa || c.motorista || (c.cargas && c.cargas !== '0'));
      const caminhoesText = caminhoesComCarga.length > 0
        ? caminhoesComCarga.map((c, i) => `   ${i + 1}. Placa: *${c.placa || '--'}* | Mot: *${c.motorista || '--'}* | Cargas: *${c.cargas || '0'}*${c.km ? ` | KM: ${c.km}` : ''}`).join('\n')
        : '   (Nenhum caminhão com cargas registradas)';

      summaryText = 
`🌾 *RETORNO DE CAMPO - PEDIDO DE CORTE* 🚜
📋 *Escala:* ${appointmentNum}
👤 *Cliente:* ${clientName}
📍 *Endereço / Fazenda:* ${f1Data.endereco || 'Conforme agendamento'} - ${f1Data.cidade || ''}/${f1Data.uf || ''}
📅 *Data:* ${f1Data.data}

🚜 *Máquina:* *${f1Data.numMaquina || 'Forrageira'}*
👷 *Operador:* *${f1Data.operador || 'Operador de Campo'}*
📏 *Área Cortada:* *${f1Data.hectares || 'Não informada'}*
⏱️ *Horímetro:* Hr T: *${f1Data.hrT || '--'}* | Hr M: *${f1Data.hrM || '--'}*

🚛 *Cargas Transportadas:*
${caminhoesText}

🚜 *Compactação (Trator):*
   Trator: ${f1Data.tratorNum || '--'} | Op: ${f1Data.tratorOperador || '--'}
   Horas Trabalhadas: *${f1Data.tratorTotalHoras || '--'}*
${f1Data.obs ? `\n📝 *Observações:* ${f1Data.obs}` : ''}

✅ _Enviado pelo operador via Silagem Fácil._`;
    } 
    else if (activeFormTab === 'compactacao') {
      const hasHr = Boolean(f2Data.hrInicial?.trim() || f2Data.hrFinal?.trim() || f2Data.totalHr?.trim());
      const hasAbast = Boolean(f2Data.abastLitros?.trim());

      if (!hasHr && !hasAbast) {
        missingWarning = 'Atenção: Os horímetros (Inicial / Final / Total de Horas) ainda não foram informados.';
      }

      summaryText = 
`🚜 *RETORNO DE CAMPO - COMPACTAÇÃO (TRATOR)* 🌾
📋 *Escala:* ${appointmentNum}
👤 *Cliente:* ${clientName}
📅 *Data:* ${f2Data.dataInicial}${f2Data.dataFinal ? ` a ${f2Data.dataFinal}` : ''}

🚜 *Trator:* *${f2Data.numTrator || 'Trator de Compactação'}*
👷 *Operador:* *${f2Data.operadorTrator || 'Operador do Trator'}*
🚜 *Forrageira de Corte:* ${f2Data.numMaquina || '--'} (Op: ${f2Data.operadorMaquina || '--'})

⏱️ *Horímetro Inicial:* *${f2Data.hrInicial || '--'}*
⏱️ *Horímetro Final:* *${f2Data.hrFinal || '--'}*
⏳ *Total de Horas Trabalhadas:* *${f2Data.totalHr || '--'}*

${f2Data.abastLitros ? `⛽ *Abastecimento:*
   Posto: ${f2Data.abastPosto || '--'} | Litros: *${f2Data.abastLitros} L* | Hr: ${f2Data.abastHr || '--'}\n` : ''}
${f2Data.abastObs ? `📝 *Observações:* ${f2Data.abastObs}\n` : ''}
✅ _Enviado pelo operador do trator via Silagem Fácil._`;
    } 
    else {
      const totalCargas = Object.keys(f3Data.loadsRecord).length;
      if (totalCargas === 0 && !f3Data.qtdeCargasLonge?.trim()) {
        missingWarning = 'Atenção: Nenhuma carga foi marcada no painel de 01 a 64 até o momento.';
      }

      const loadEntries = Object.entries(f3Data.loadsRecord).sort((a, b) => Number(a[0]) - Number(b[0]));
      const listLoads = loadEntries.length > 0
        ? loadEntries.map(([n, t]) => `${n}ª às ${t}h`).join(' • ')
        : 'Nenhuma carga marcada';

      summaryText = 
`🚛 *RETORNO DE CAMPO - CONTROLE DE CARGAS* 🌾
📋 *Escala:* ${appointmentNum}
👤 *Cliente:* ${clientName}
📍 *Endereço:* ${f3Data.endereco || 'Conforme agendamento'}
📅 *Data:* ${f3Data.data}

🚛 *Placa do Veículo:* *${f3Data.placa || 'N/A'}*
👷 *Motorista:* *${f3Data.motorista || 'Motorista'}*
🚜 *Máquina Colhedora:* ${f3Data.maquina || 'N/A'}

📦 *TOTAL DE CARGAS REALIZADAS:* *${totalCargas} cargas*
🕒 *Horários Registrados:*
${listLoads}

${f3Data.km ? `🛣️ *KM Rodado:* ${f3Data.km} km\n` : ''}
${f3Data.qtdeCargasLonge ? `🛣️ *Cargas Distantes:* ${f3Data.qtdeCargasLonge}\n` : ''}
${f3Data.abastLitros ? `⛽ *Abastecimento:* ${f3Data.abastLitros} L (${f3Data.abastPosto || 'Posto'}) | KM: ${f3Data.abastKm || '--'}\n` : ''}
${f3Data.abastObs ? `📝 *Observações:* ${f3Data.abastObs}\n` : ''}
✅ _Enviado pelo motorista via Silagem Fácil._`;
    }

    // Se houver campos não preenchidos, solicita confirmação
    if (missingWarning) {
      const confirmed = window.confirm(`${missingWarning}\n\nDeseja enviar de volta para o escritório mesmo assim?`);
      if (!confirmed) return;
    }

    // 2. Salvar no Banco de Dados / LocalStorage
    try {
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newSubmission = {
        id: submissionId,
        appointmentId: loadedAppointment?.id,
        appointmentNumber: appointmentNum,
        formType: activeFormTab,
        submittedAt: new Date().toISOString(),
        clientName: clientName,
        operatorOrDriver: operatorName,
        machineryOrVehicle: f1Data.numMaquina || f2Data.numTrator || f3Data.placa || '',
        formData: activeFormTab === 'corte' ? f1Data : activeFormTab === 'compactacao' ? f2Data : f3Data,
        summaryText: summaryText,
      };

      addStoredFieldSubmission(newSubmission);

      if (loadedAppointment?.appointmentNumber) {
        updateAppointmentFieldReturn(
          loadedAppointment.appointmentNumber,
          activeFormTab,
          `Enviado por ${operatorName} em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        );
      }
    } catch (e) {
      console.error('Erro ao salvar formulário de campo:', e);
    }

    // 3. Abrir WhatsApp formatado com o texto
    const encodedMsg = encodeURIComponent(summaryText);
    const waUrl = targetPhone 
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`;

    setSentWhatsAppUrl(waUrl);
    setShowSuccessModal(true);

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3">
      
      {/* 
        NO MODO OPERADOR EXTERNO:
        - O cabeçalho verde "ESCALA IDENTIFICADA" foi completamente removido.
        - A barra cinza/azul de seleção de abas foi completamente ocultada.
        - Exibe no topo apenas a barra de ação com o botão verde destacado "Enviar de volta".
      */}
      {isOperatorModeActive ? (
        <div className="no-print w-full flex items-center justify-between gap-2 bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#188038] animate-pulse"></span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs sm:text-sm uppercase tracking-tight text-stone-900 dark:text-stone-100">
                {activeFormTab === 'corte' && '1. Pedido de Corte (Forrageira)'}
                {activeFormTab === 'compactacao' && '2. Controle de Compactação (Trator)'}
                {activeFormTab === 'cargas' && '3. Controle de Cargas (Motorista)'}
              </span>
              {loadedAppointment && (
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold hidden sm:inline">
                  • {loadedAppointment.appointmentNumber} ({loadedAppointment.clientName})
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnviarDeVolta}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#188038] hover:bg-[#146c2e] text-white rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5 active:scale-95"
            title="Salvar respostas e abrir WhatsApp da empresa"
          >
            <Send className="w-4 h-4" />
            <span>Enviar de volta</span>
          </button>
        </div>
      ) : (
        /* Modo Administrativo Interno da Empresa (quando acessado pelo menu normal) */
        <div className="no-print bg-[#204e87] dark:bg-stone-900 p-2 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm border border-blue-400/30">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveFormTab('corte')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFormTab === 'corte'
                  ? 'bg-[#188038] text-white shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>1. Pedido de Corte (Forrageira)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('compactacao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFormTab === 'compactacao'
                  ? 'bg-[#188038] text-white shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Tractor className="w-3.5 h-3.5" />
              <span>2. Controle de Compactação (Trator)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('cargas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFormTab === 'cargas'
                  ? 'bg-[#188038] text-white shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>3. Controle de Cargas (01 a 64)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir Formulário / Salvar PDF"
            >
              <Printer className="w-3.5 h-3.5 text-stone-700" />
              <span>Imprimir Bloco</span>
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DE EXIBIÇÃO DO FORMULÁRIO SELECIONADO */}
      <div className="w-full flex justify-center py-2">
        
        {/* ========================================================================= */}
        {/* 1. FORMULÁRIO DE PEDIDO DE CORTE (Operador da Forrageira) */}
        {/* ========================================================================= */}
        {activeFormTab === 'corte' && (
          <div className="w-full max-w-4xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho Oficial Dinâmico */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName || 'Logomarca'} 
                    className="h-16 w-auto max-w-[150px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : companyTradeName ? (
                  <div className="border-2 border-stone-900 rounded-md px-3 py-1 font-black text-xl tracking-tighter bg-stone-100 text-stone-900">
                    {companyTradeName}
                  </div>
                ) : null}
                <div>
                  {companyTradeName && <h2 className="text-base font-black tracking-tight uppercase">{companyTradeName}</h2>}
                  {companyCnpj && <p className="text-[11px] font-semibold text-stone-600">CNPJ: {companyCnpj}</p>}
                  {companyAddress && <p className="text-[10px] text-stone-500">{companyAddress}</p>}
                  {companyPhone && (
                    <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#188038]" />
                      {companyPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Badge Verde PEDIDO 0001 */}
              <div className="text-center shrink-0">
                <div className="bg-[#188038] text-white px-5 py-1 rounded-md font-black text-sm uppercase tracking-wider shadow-xs">
                  PEDIDO
                </div>
                <div className="text-rose-600 font-mono font-black text-lg mt-1 tracking-widest">
                  0001
                </div>
              </div>
            </div>

            {/* Linhas de Dados Iniciais */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              <div className="sm:col-span-3 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Data:</span>
                <input 
                  type="text" 
                  value={f1Data.data} 
                  onChange={e => setF1Data({...f1Data, data: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="sm:col-span-9 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cliente:</span>
                <input 
                  type="text" 
                  value={f1Data.cliente} 
                  onChange={e => setF1Data({...f1Data, cliente: e.target.value})}
                  list="clients-f1-list"
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do produtor / fazenda"
                />
                <datalist id="clients-f1-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="sm:col-span-12 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Endereço:</span>
                <input 
                  type="text" 
                  value={f1Data.endereco} 
                  onChange={e => setF1Data({...f1Data, endereco: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Linha, estrada ou ponto de referência"
                />
              </div>

              <div className="sm:col-span-8 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cidade:</span>
                <input 
                  type="text" 
                  value={f1Data.cidade} 
                  onChange={e => setF1Data({...f1Data, cidade: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-4 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">UF:</span>
                <input 
                  type="text" 
                  value={f1Data.uf} 
                  onChange={e => setF1Data({...f1Data, uf: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 uppercase" 
                />
              </div>

              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">CNPJ/CPF:</span>
                <input 
                  type="text" 
                  value={f1Data.cnpjCpf} 
                  onChange={e => setF1Data({...f1Data, cnpjCpf: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Inscr. Est. / RG:</span>
                <input 
                  type="text" 
                  value={f1Data.inscrEst} 
                  onChange={e => setF1Data({...f1Data, inscrEst: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>

              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cond. de Pagto.:</span>
                <input 
                  type="text" 
                  value={f1Data.condPagto} 
                  onChange={e => setF1Data({...f1Data, condPagto: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Fone(s):</span>
                <input 
                  type="text" 
                  value={f1Data.fone} 
                  onChange={e => setF1Data({...f1Data, fone: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
            </div>

            {/* Linha Máquina e Operador (Barra Cinza) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>Nº DA MÁQUINA:</span>
                <input 
                  type="text" 
                  value={f1Data.numMaquina} 
                  onChange={e => setF1Data({...f1Data, numMaquina: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="Ex: Forrageira 01"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>OPERADOR:</span>
                <input 
                  type="text" 
                  value={f1Data.operador} 
                  onChange={e => setF1Data({...f1Data, operador: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="Nome do operador"
                />
              </div>
            </div>

            {/* Linha Hectares e Valor ha/hr */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>HECTARES:</span>
                <input 
                  type="text" 
                  value={f1Data.hectares} 
                  onChange={e => setF1Data({...f1Data, hectares: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="0,00 ha"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>VALOR HA / HR:</span>
                <input 
                  type="text" 
                  value={f1Data.valorHaHr} 
                  onChange={e => setF1Data({...f1Data, valorHaHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* HR / T | HR / M | VALOR TOTAL R$ */}
            <div className="grid grid-cols-3 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase text-center">
              <div className="flex items-center justify-center gap-1">
                <span>HR / T:</span>
                <input 
                  type="text" 
                  value={f1Data.hrT} 
                  onChange={e => setF1Data({...f1Data, hrT: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-20 text-center text-stone-900" 
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>HR / M:</span>
                <input 
                  type="text" 
                  value={f1Data.hrM} 
                  onChange={e => setF1Data({...f1Data, hrM: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-20 text-center text-stone-900" 
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>VALOR TOTAL R$:</span>
                <input 
                  type="text" 
                  value={f1Data.valorTotalCorte} 
                  onChange={e => setF1Data({...f1Data, valorTotalCorte: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-28 text-center text-stone-900 font-black" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Grid dos Caminhões (Até 5 linhas com fundo verde suave idêntico ao modelo) */}
            <div className="space-y-1">
              {f1Data.caminhoes.map((c, idx) => (
                <div 
                  key={c.id} 
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 bg-[#e0f0e3] p-1.5 rounded font-bold uppercase items-center"
                >
                  <div className="sm:col-span-3 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">CAM. PLACA:</span>
                    <input 
                      type="text" 
                      value={c.placa} 
                      onChange={e => handleTruckChange(idx, 'placa', e.target.value)}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-stone-900" 
                      placeholder="Placa"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1">
                    <span className="text-[10px] text-stone-600 shrink-0">MOTORISTA:</span>
                    <input 
                      type="text" 
                      value={c.motorista} 
                      onChange={e => handleTruckChange(idx, 'motorista', e.target.value)}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-stone-900" 
                      placeholder="Nome"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">CARGAS:</span>
                    <input 
                      type="number" 
                      value={c.cargas} 
                      onChange={e => handleTruckChange(idx, 'cargas', e.target.value)}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center text-stone-900" 
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">KM:</span>
                    <input 
                      type="text" 
                      value={c.km} 
                      onChange={e => handleTruckChange(idx, 'km', e.target.value)}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center text-stone-900" 
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Linha Valor Total dos Caminhões */}
            <div className="bg-stone-200 p-2 rounded font-bold uppercase flex items-center justify-between">
              <span>VALOR TOTAL DOS CAMINHÕES R$:</span>
              <input 
                type="text" 
                value={f1Data.valorTotalCaminhoes} 
                onChange={e => setF1Data({...f1Data, valorTotalCaminhoes: e.target.value})}
                className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-36 text-right font-black text-stone-900" 
                placeholder="R$ 0,00"
              />
            </div>

            {/* Seção COMPACTAÇÃO - HORÍMETRO (Barra Preta) */}
            <div className="bg-stone-900 text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider">
              COMPACTAÇÃO - HORÍMETRO
            </div>

            {/* Grade de Compactação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>Nº TRATOR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorNum} 
                  onChange={e => setF1Data({...f1Data, tratorNum: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>VALOR HR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorValorHr} 
                  onChange={e => setF1Data({...f1Data, tratorValorHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>OPERADOR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorOperador} 
                  onChange={e => setF1Data({...f1Data, tratorOperador: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>TOTAL DE HORAS:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorTotalHoras} 
                  onChange={e => setF1Data({...f1Data, tratorTotalHoras: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
            </div>

            {/* Obs e TOTAL R$ */}
            <div className="border-b border-stone-300 pb-2">
              <span className="font-bold text-stone-700">OBS.:</span>
              <input 
                type="text" 
                value={f1Data.obs} 
                onChange={e => setF1Data({...f1Data, obs: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 mt-1" 
                placeholder="Observações complementares do pedido de corte"
              />
            </div>

            {/* Rodapé com 'Obrigado pela preferência!' e 'TOTAL R$' */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 items-center">
              <div className="sm:col-span-6 border-2 border-[#188038] rounded-lg p-2 text-center">
                <span className="font-serif italic text-lg sm:text-xl font-bold text-[#188038]">
                  Obrigado pela preferência!
                </span>
              </div>
              
              <div className="sm:col-span-6 flex items-center bg-stone-900 text-white rounded-lg overflow-hidden border border-stone-900">
                <span className="bg-stone-900 px-4 py-2 font-black text-sm uppercase tracking-wider shrink-0">
                  TOTAL R$
                </span>
                <input 
                  type="text" 
                  value={f1Data.totalGeral} 
                  onChange={e => setF1Data({...f1Data, totalGeral: e.target.value})}
                  className="w-full bg-white text-stone-950 px-3 py-2 text-sm sm:text-base font-black text-right border-none focus:ring-0" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Campo de Assinatura do Cliente */}
            <div className="pt-6 pb-2 text-center">
              <div className="w-72 mx-auto border-t border-stone-700 pt-1 text-[11px] font-semibold text-stone-700">
                Assinatura do Cliente
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. FORMULÁRIO DE CONTROLE DE COMPACTAÇÃO (Operador do Trator) */}
        {/* ========================================================================= */}
        {activeFormTab === 'compactacao' && (
          <div className="w-full max-w-2xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3.5 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName || 'Logomarca'} 
                    className="h-14 w-auto max-w-[130px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : companyTradeName ? (
                  <div className="border-2 border-stone-900 rounded-md px-2.5 py-1 font-black text-base bg-stone-100">
                    {companyTradeName}
                  </div>
                ) : null}
                <div>
                  {companyTradeName && <h2 className="text-sm font-black uppercase">{companyTradeName}</h2>}
                  {companyCnpj && <p className="text-[10px] font-bold text-stone-600">CNPJ: {companyCnpj}</p>}
                  {companyAddress && <p className="text-[10px] text-stone-500">{companyAddress}</p>}
                  {companyPhone && (
                    <p className="text-[10px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                      <Phone className="w-2.5 h-2.5 text-[#188038]" />
                      {companyPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Título Verde CONTROLE COMPACTAÇÃO */}
              <div className="text-right shrink-0">
                <span className="font-black text-sm sm:text-base text-[#188038] uppercase tracking-tight block">
                  CONTROLE COMPACTAÇÃO
                </span>
                <span className="text-[10px] font-mono text-stone-500 font-bold">LIVRO DE CAMPO</span>
              </div>
            </div>

            {/* Linha Datas e Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Data Inicial:</span>
                <input 
                  type="text" 
                  value={f2Data.dataInicial} 
                  onChange={e => setF2Data({...f2Data, dataInicial: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Data Final:</span>
                <input 
                  type="text" 
                  value={f2Data.dataFinal} 
                  onChange={e => setF2Data({...f2Data, dataFinal: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
            </div>

            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Cliente:</span>
              <input 
                type="text" 
                value={f2Data.cliente} 
                onChange={e => setF2Data({...f2Data, cliente: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Nome do cliente produtor"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Nº Trator:</span>
                <input 
                  type="text" 
                  value={f2Data.numTrator} 
                  onChange={e => setF2Data({...f2Data, numTrator: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Ex: Trator 04"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Operador:</span>
                <input 
                  type="text" 
                  value={f2Data.operadorTrator} 
                  onChange={e => setF2Data({...f2Data, operadorTrator: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Operador do trator"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Nº Máquina:</span>
                <input 
                  type="text" 
                  value={f2Data.numMaquina} 
                  onChange={e => setF2Data({...f2Data, numMaquina: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Ex: Forrageira 01"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Operador:</span>
                <input 
                  type="text" 
                  value={f2Data.operadorMaquina} 
                  onChange={e => setF2Data({...f2Data, operadorMaquina: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Operador da forrageira"
                />
              </div>
            </div>

            {/* Linha Horímetro: HR INICIAL | HR FINAL | TOTAL HR */}
            <div className="grid grid-cols-3 gap-2 bg-stone-200 p-2 rounded font-bold uppercase text-center">
              <div>
                <span className="text-[10px] block">HR INICIAL:</span>
                <input 
                  type="text" 
                  value={f2Data.hrInicial} 
                  onChange={e => setF2Data({...f2Data, hrInicial: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                />
              </div>
              <div>
                <span className="text-[10px] block">HR FINAL:</span>
                <input 
                  type="text" 
                  value={f2Data.hrFinal} 
                  onChange={e => setF2Data({...f2Data, hrFinal: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                />
              </div>
              <div>
                <span className="text-[10px] block">TOTAL HR:</span>
                <input 
                  type="text" 
                  value={f2Data.totalHr} 
                  onChange={e => setF2Data({...f2Data, totalHr: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5 font-black" 
                />
              </div>
            </div>

            {/* VALOR HR | VALOR TOTAL */}
            <div className="grid grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase text-center">
              <div className="flex items-center justify-center gap-1">
                <span>VALOR HR:</span>
                <input 
                  type="text" 
                  value={f2Data.valorHr} 
                  onChange={e => setF2Data({...f2Data, valorHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-28 text-center" 
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>VALOR TOTAL:</span>
                <input 
                  type="text" 
                  value={f2Data.valorTotal} 
                  onChange={e => setF2Data({...f2Data, valorTotal: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-32 text-center font-black" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* SEÇÃO ACOPLADA: CONTROLE ABASTECIMENTO (Barra Verde #188038) */}
            <div className="pt-2">
              <div className="bg-[#188038] text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider shadow-xs">
                CONTROLE ABASTECIMENTO
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>DATA:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastData} 
                      onChange={e => setF2Data({...f2Data, abastData: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>POSTO:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastPosto} 
                      onChange={e => setF2Data({...f2Data, abastPosto: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                      placeholder="Nome do posto"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase text-center">
                  <div>
                    <span className="text-[10px] block">LITROS:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastLitros} 
                      onChange={e => setF2Data({...f2Data, abastLitros: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                    />
                  </div>
                  <div>
                    <span className="text-[10px] block">VALOR LITRO:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastValorLitro} 
                      onChange={e => setF2Data({...f2Data, abastValorLitro: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] block">HR:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastHr} 
                      onChange={e => setF2Data({...f2Data, abastHr: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                    />
                  </div>
                </div>

                <div className="bg-[#e0f0e3] p-2 rounded font-bold uppercase flex items-center justify-between">
                  <span>VALOR TOTAL R$:</span>
                  <input 
                    type="text" 
                    value={f2Data.abastValorTotal} 
                    onChange={e => setF2Data({...f2Data, abastValorTotal: e.target.value})}
                    className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-36 text-right font-black" 
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="border-b border-stone-300 pb-1 pt-1 flex items-center gap-1">
                  <span className="font-bold text-stone-700">Obs.:</span>
                  <input 
                    type="text" 
                    value={f2Data.abastObs} 
                    onChange={e => setF2Data({...f2Data, abastObs: e.target.value})}
                    className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FORMULÁRIO DE CONTROLE DE CARGAS (01 a 64) */}
        {/* ========================================================================= */}
        {activeFormTab === 'cargas' && (
          <div className="w-full max-w-2xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3.5 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName || 'Logomarca'} 
                    className="h-14 w-auto max-w-[130px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : companyTradeName ? (
                  <div className="border-2 border-stone-900 rounded-md px-2.5 py-1 font-black text-base bg-stone-100">
                    {companyTradeName}
                  </div>
                ) : null}
                <div>
                  {companyTradeName && <h2 className="text-sm font-black uppercase">{companyTradeName}</h2>}
                  {companyCnpj && <p className="text-[10px] font-bold text-stone-600">CNPJ: {companyCnpj}</p>}
                  {companyAddress && <p className="text-[10px] text-stone-500">{companyAddress}</p>}
                  {companyPhone && (
                    <p className="text-[10px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                      <Phone className="w-2.5 h-2.5 text-[#188038]" />
                      {companyPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Título Verde */}
              <div className="text-right shrink-0">
                <span className="font-black text-sm sm:text-base text-[#188038] uppercase tracking-tight block">
                  CONTROLE DE CARGAS
                </span>
                <span className="text-[10px] font-mono text-stone-500 font-bold">TRANSPORTE / CAMINHÕES</span>
              </div>
            </div>

            {/* Dados: Data e Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-b border-stone-300 pb-1">
              <div className="sm:col-span-4 flex items-center gap-1">
                <span className="font-bold text-stone-700">Data:</span>
                <input 
                  type="text" 
                  value={f3Data.data} 
                  onChange={e => setF3Data({...f3Data, data: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="sm:col-span-8 flex items-center gap-1">
                <span className="font-bold text-stone-700">Cliente:</span>
                <input 
                  type="text" 
                  value={f3Data.cliente} 
                  onChange={e => setF3Data({...f3Data, cliente: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do cliente"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Endereço:</span>
              <input 
                type="text" 
                value={f3Data.endereco} 
                onChange={e => setF3Data({...f3Data, endereco: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Local de corte / entrega"
              />
            </div>

            {/* Seletor Rápido de Caminhões Escalados */}
            {scheduledTrucks.length > 0 && (
              <div className="no-print flex items-center gap-1.5 flex-wrap bg-stone-50 p-1.5 rounded border border-stone-200 text-[11px]">
                <span className="font-bold text-stone-600 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-[#188038]" />
                  Veículos da Escala:
                </span>
                {scheduledTrucks.map((truck, idx) => {
                  const plateOrPref = truck.plateOrSerial || truck.prefix || '';
                  const driverName = truck.driverOrOperatorName || '';
                  const isSelected = f3Data.placa && (plateOrPref.includes(f3Data.placa) || f3Data.placa.includes(plateOrPref));
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setF3Data(prev => ({
                          ...prev,
                          placa: plateOrPref,
                          motorista: driverName || prev.motorista,
                        }));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-[#188038] text-white border-[#188038] shadow-xs' 
                          : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300'
                      }`}
                    >
                      <span>{plateOrPref}</span>
                      {driverName && <span className="opacity-80">({driverName.split(' ')[0]})</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Placa e Motorista */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-b border-stone-300 pb-1">
              <div className="sm:col-span-5 flex items-center gap-1">
                <span className="font-bold text-stone-700">Placa:</span>
                <input 
                  type="text" 
                  value={f3Data.placa} 
                  onChange={e => setF3Data({...f3Data, placa: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 uppercase" 
                  placeholder="Placa"
                />
              </div>
              <div className="sm:col-span-7 flex items-center gap-1">
                <span className="font-bold text-stone-700">Motorista:</span>
                <input 
                  type="text" 
                  value={f3Data.motorista} 
                  onChange={e => setF3Data({...f3Data, motorista: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do condutor"
                />
              </div>
            </div>

            {/* Máquina */}
            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Máquina:</span>
              <input 
                type="text" 
                value={f3Data.maquina} 
                onChange={e => setF3Data({...f3Data, maquina: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Forrageira responsável pelo corte"
              />
            </div>

            {/* PAINEL DE BOTÕES DE 01 A 64: Cargas Selecionáveis em Tempo Real com Registro de Horário */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-stone-800">
                  Cargas: <span className="text-[#188038] font-black">({Object.keys(f3Data.loadsRecord).length} marcadas)</span>
                </span>
                {Object.keys(f3Data.loadsRecord).length > 0 && (
                  <span className="text-[11px] text-stone-500 font-medium">
                    Toque no número para marcar com horário automático. Toque novamente para desmarcar.
                  </span>
                )}
              </div>

              {/* Grid de botões numéricos com visual idêntico ao bloco impresso */}
              <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-8 lg:grid-cols-8 xl:grid-cols-8 gap-1.5 p-2 bg-stone-100 rounded-lg border border-stone-300">
                {Array.from({ length: 64 }, (_, i) => i + 1).map(num => {
                  const numStr = num < 10 ? `0${num}` : `${num}`;
                  const recordTime = f3Data.loadsRecord[num];
                  const isChecked = !!recordTime;

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleLoadClick(num)}
                      className={`min-h-[38px] py-1 px-1 rounded-md border font-mono transition cursor-pointer select-none flex flex-col items-center justify-center leading-none ${
                        isChecked
                          ? 'bg-[#188038] text-white border-[#188038] shadow-xs'
                          : 'bg-white text-stone-800 border-stone-400 hover:bg-stone-200'
                      }`}
                      title={
                        isChecked
                          ? `Carga ${numStr} registrada às ${recordTime}h (Clique para desmarcar)`
                          : `Clique para registrar Carga ${numStr}`
                      }
                    >
                      <span className="font-black text-xs tracking-tight">{numStr}</span>
                      {isChecked ? (
                        <span className="text-[10px] font-semibold text-emerald-100 mt-0.5 tracking-tighter">
                          {recordTime}h
                        </span>
                      ) : (
                        <span className="text-[9px] text-transparent mt-0.5 select-none">--:--</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QTDE DE CARGAS LONGE | KM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>QTDE DE CARGAS LONGE:</span>
                <input 
                  type="number" 
                  value={f3Data.qtdeCargasLonge} 
                  onChange={e => setF3Data({...f3Data, qtdeCargasLonge: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-20 text-center font-black" 
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>KM:</span>
                <input 
                  type="text" 
                  value={f3Data.km} 
                  onChange={e => setF3Data({...f3Data, km: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-center font-black" 
                  placeholder="0"
                />
              </div>
            </div>

            {/* SEÇÃO ACOPLADA: CONTROLE ABASTECIMENTO (Barra Verde #188038) */}
            <div className="pt-2">
              <div className="bg-[#188038] text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider shadow-xs">
                CONTROLE ABASTECIMENTO
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>POSTO:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastPosto} 
                      onChange={e => setF3Data({...f3Data, abastPosto: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                      placeholder="Nome do posto"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>LITROS:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastLitros} 
                      onChange={e => setF3Data({...f3Data, abastLitros: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>VALOR POR LITRO:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastValorPorLitro} 
                      onChange={e => setF3Data({...f3Data, abastValorPorLitro: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>KM:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastKm} 
                      onChange={e => setF3Data({...f3Data, abastKm: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>VALOR TOTAL:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastValorTotal} 
                      onChange={e => setF3Data({...f3Data, abastValorTotal: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-right font-black" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>HR:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastHr} 
                      onChange={e => setF3Data({...f3Data, abastHr: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="Horímetro"
                    />
                  </div>
                </div>

                <div className="border-b border-stone-300 pb-1 pt-1 flex items-center gap-1">
                  <span className="font-bold text-stone-700">Obs.:</span>
                  <input 
                    type="text" 
                    value={f3Data.abastObs} 
                    onChange={e => setF3Data({...f3Data, abastObs: e.target.value})}
                    className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                    placeholder="Observações do abastecimento"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Botão de Enviar de volta no final da folha para facilidade de uso em dispositivos móveis */}
      {isOperatorModeActive && (
        <div className="no-print w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 pb-8 px-4">
          <button
            type="button"
            onClick={handleEnviarDeVolta}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#188038] hover:bg-[#146c2e] text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl cursor-pointer transform active:scale-95"
          >
            <Send className="w-5 h-5" />
            <span>Enviar de volta para a Empresa</span>
          </button>
        </div>
      )}

      {/* MODAL DE SUCESSO APÓS ENVIAR DE VOLTA */}
      {showSuccessModal && (
        <div 
          id="modal-success-enviar-de-volta" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 space-y-4 text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-[#188038]">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-stone-900 dark:text-stone-100 uppercase tracking-tight">
                Dados Registrados com Sucesso!
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5">
                Os dados da sua jornada foram salvos no sistema e direcionados para o WhatsApp da empresa.
              </p>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl text-left text-[11px] text-stone-700 dark:text-stone-300 space-y-1 font-mono border border-stone-200/60 dark:border-stone-700/60">
              <div><strong className="text-stone-900 dark:text-white">Escala:</strong> {loadedAppointment?.appointmentNumber || 'N/A'}</div>
              <div><strong className="text-stone-900 dark:text-white">Cliente:</strong> {f1Data.cliente || f2Data.cliente || f3Data.cliente}</div>
              <div><strong className="text-stone-900 dark:text-white">Destino:</strong> {companyTradeName} ({companyPhone})</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  if (sentWhatsAppUrl) {
                    window.open(sentWhatsAppUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="px-4 py-2.5 bg-[#188038] hover:bg-[#146c2e] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Reabrir WhatsApp</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA DESMARCAR CARGA */}
      {loadToUncheck && (
        <div 
          id="modal-confirm-uncheck-load" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-stone-200 text-stone-900 space-y-4">
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Confirmar Desmarcação de Carga
                  </h3>
                  <p className="text-xs text-stone-500">
                    Controle de Cargas (Silagem)
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={cancelUncheckLoad}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1.5">
              <p className="font-semibold text-stone-900">
                Deseja realmente desmarcar e remover o registro da{' '}
                <span className="text-[#188038] font-black">
                  Carga Nº {loadToUncheck.num < 10 ? `0${loadToUncheck.num}` : loadToUncheck.num}
                </span>{' '}
                gravada às{' '}
                <span className="font-bold text-stone-900">{loadToUncheck.time}h</span>?
              </p>
              <p className="text-[11px] text-stone-500">
                O botão voltará ao estado limpo (branco) e o horário será apagado.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelUncheckLoad}
                className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={confirmUncheckLoad}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Sim, desmarcar carga
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
