import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  GripVertical, 
  MoveRight, 
  Settings, 
  Palette, 
  Tractor, 
  Check, 
  X, 
  Save, 
  UserPlus, 
  FileSpreadsheet, 
  LayoutGrid, 
  Printer, 
  HelpCircle,
  Phone,
  Briefcase,
  AlertCircle,
  Clock,
  Car,
  MessageCircle
} from 'lucide-react';
import { Employee, Machinery, FleetTeam, CompanyProfile } from '../../types';
import { getStoredCompanyProfile, formatDateBR } from '../../lib/storage';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { sendViaWhatsApp } from '../../lib/printService';
import { useConfirm } from '../../context/ConfirmContext';

interface FleetTeamViewProps {

  employees: Employee[];
  machineries: Machinery[];
  teams?: FleetTeam[];
  companyProfile?: CompanyProfile;
  onSaveEmployees: (employees: Employee[]) => void;
  onSaveTeams?: (teams: FleetTeam[]) => void;
}

// Preset color options matching the spreadsheet vibe and professional agtech colors
export const TEAM_COLOR_PALETTES = [
  { id: 'yellow_cream', name: 'Amarelo Claro (Maq 02)', headerBg: '#fef08a', columnBg: '#fefce8', border: '#ca8a04' },
  { id: 'peach_orange', name: 'Pêssego / Laranja (Maq 03)', headerBg: '#fed7aa', columnBg: '#fff7ed', border: '#ea580c' },
  { id: 'light_green', name: 'Verde Pastel (Maq 04)', headerBg: '#bbf7d0', columnBg: '#f0fdf4', border: '#16a34a' },
  { id: 'gold_yellow', name: 'Amarelo Ouro (Maq 05)', headerBg: '#fde047', columnBg: '#fef9c3', border: '#eab308' },
  { id: 'sky_blue', name: 'Azul Céu', headerBg: '#bae6fd', columnBg: '#f0f9ff', border: '#0284c7' },
  { id: 'violet_purple', name: 'Violeta / Roxo', headerBg: '#ddd6fe', columnBg: '#f5f3ff', border: '#7c3aed' },
  { id: 'rose_pink', name: 'Rosa Suave', headerBg: '#fecdd3', columnBg: '#fff1f2', border: '#e11d48' },
  { id: 'slate_gray', name: 'Cinza Metálico', headerBg: '#e2e8f0', columnBg: '#f8fafc', border: '#64748b' },
];

export const FleetTeamView: React.FC<FleetTeamViewProps> = ({
  employees,
  machineries,
  teams: externalTeams,
  companyProfile,
  onSaveEmployees,
  onSaveTeams,
}) => {
  // Local fallback if no teams provided
  const defaultInitialTeams: FleetTeam[] = [
    {
      id: 'team_maq_02',
      name: 'Maq 02',
      headerBgColor: '#fef08a',
      columnBgColor: '#fefce8',
      borderColor: '#ca8a04',
      machineryId: 'veh_forr_05_2023',
      machineryName: 'FORR 05 2023 (Claas 870)',
      notes: 'Equipe de corte colheita alta performance',
      order: 1,
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: 'team_maq_03',
      name: 'Maq 03',
      headerBgColor: '#fed7aa',
      columnBgColor: '#fff7ed',
      borderColor: '#ea580c',
      machineryId: 'veh_colh_02_2022',
      machineryName: 'COLH 02 2022 (Claas 860)',
      notes: 'Frente colheita 2 - Vale do Iguaçu',
      order: 2,
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: 'team_maq_04',
      name: 'Maq 04',
      headerBgColor: '#bbf7d0',
      columnBgColor: '#f0fdf4',
      borderColor: '#16a34a',
      machineryId: 'veh_trator_jd_6110',
      machineryName: 'Trator JD 6110J + JF C120',
      notes: 'Frente colheita 3 & compactação pesada',
      order: 3,
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: 'team_maq_05',
      name: 'Maq 05',
      headerBgColor: '#fde047',
      columnBgColor: '#fef9c3',
      borderColor: '#eab308',
      machineryId: 'veh_evd_2j61',
      machineryName: 'Frota MB 2726 + Suporte',
      notes: 'Frente transporte, transbordo e lona',
      order: 4,
      createdAt: '2026-08-01T08:00:00Z',
    },
  ];

  const teams = externalTeams && externalTeams.length > 0 ? externalTeams : defaultInitialTeams;

  // View mode: 'table' (like the uploaded spreadsheet print) or 'cards' (rich Kanban cards)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(true);


  // Drag and Drop state
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Team Modal state (Create / Edit Team)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<FleetTeam | null>(null);
  const [teamFormName, setTeamFormName] = useState('');
  const [teamFormMachineryId, setTeamFormMachineryId] = useState('');
  const [teamFormHeaderBg, setTeamFormHeaderBg] = useState('#fef08a');
  const [teamFormColumnBg, setTeamFormColumnBg] = useState('#fefce8');
  const [teamFormBorderColor, setTeamFormBorderColor] = useState('#ca8a04');
  const [teamFormNotes, setTeamFormNotes] = useState('');

  // Employee Modal state (Create / Edit Employee)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empFormName, setEmpFormName] = useState('');
  const [empFormRole, setEmpFormRole] = useState('Operador de Ensiladeira');
  const [empFormPhone, setEmpFormPhone] = useState('');
  const [empFormTeamId, setEmpFormTeamId] = useState('');
  const [empFormStatus, setEmpFormStatus] = useState<Employee['status']>('ativo');

  // Quick Move Dropdown menu on employee
  const [openMoveMenuEmpId, setOpenMoveMenuEmpId] = useState<string | null>(null);

  // Trigger temporary notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Group employees by team
  const { teamEmployeesMap, unassignedEmployees } = useMemo(() => {
    const map: Record<string, Employee[]> = {};
    const unassigned: Employee[] = [];

    // Initialize all teams with empty arrays
    teams.forEach(t => {
      map[t.id] = [];
    });

    // Distribute employees
    employees.forEach(emp => {
      // Check search match
      const matchSearch =
        !searchTerm ||
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return;

      if (emp.teamId && map[emp.teamId]) {
        map[emp.teamId].push(emp);
      } else {
        unassigned.push(emp);
      }
    });

    return { teamEmployeesMap: map, unassignedEmployees: unassigned };
  }, [employees, teams, searchTerm]);

  // Save Teams Handler
  const handleSaveTeamsList = (newTeams: FleetTeam[]) => {
    if (onSaveTeams) {
      onSaveTeams(newTeams);
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, empId: string) => {
    e.dataTransfer.setData('text/plain', empId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedEmployeeId(empId);
  };

  const handleDragEnd = () => {
    setDraggedEmployeeId(null);
    setDragOverTeamId(null);
  };

  const handleDragOver = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTeamId !== teamId) {
      setDragOverTeamId(teamId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, teamId: string) => {
    // Only clear if actually leaving the container
    if (dragOverTeamId === teamId) {
      setDragOverTeamId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTeamId: string) => {
    e.preventDefault();
    const empId = e.dataTransfer.getData('text/plain') || draggedEmployeeId;
    setDragOverTeamId(null);
    setDraggedEmployeeId(null);

    if (!empId) return;

    const targetEmp = employees.find(emp => emp.id === empId);
    if (!targetEmp) return;

    const newTeamId = targetTeamId === 'unassigned' ? undefined : targetTeamId;
    if (targetEmp.teamId === newTeamId) return; // already in this team

    const updatedEmployees = employees.map(emp =>
      emp.id === empId ? { ...emp, teamId: newTeamId } : emp
    );

    onSaveEmployees(updatedEmployees);

    const targetTeamObj = teams.find(t => t.id === targetTeamId);
    const destinationName = targetTeamId === 'unassigned' ? 'Banco de Disponíveis' : targetTeamObj?.name || 'Nova Equipe';
    showToast(`✅ ${targetEmp.name} transferido para ${destinationName}`);
  };

  // Direct move button
  const handleDirectMove = (empId: string, targetTeamId: string) => {
    const targetEmp = employees.find(emp => emp.id === empId);
    if (!targetEmp) return;

    const newTeamId = targetTeamId === 'unassigned' ? undefined : targetTeamId;
    const updatedEmployees = employees.map(emp =>
      emp.id === empId ? { ...emp, teamId: newTeamId } : emp
    );

    onSaveEmployees(updatedEmployees);
    setOpenMoveMenuEmpId(null);

    const targetTeamObj = teams.find(t => t.id === targetTeamId);
    const destinationName = targetTeamId === 'unassigned' ? 'Banco de Disponíveis' : targetTeamObj?.name || 'Nova Equipe';
    showToast(`✅ ${targetEmp.name} transferido para ${destinationName}`);
  };

  // --- TEAM CRUD HANDLERS ---
  const openNewTeamModal = () => {
    setEditingTeam(null);
    const nextNum = (teams.length + 1).toString().padStart(2, '0');
    setTeamFormName(`Maq ${nextNum}`);
    setTeamFormMachineryId('');
    
    // Pick next palette
    const pal = TEAM_COLOR_PALETTES[teams.length % TEAM_COLOR_PALETTES.length];
    setTeamFormHeaderBg(pal.headerBg);
    setTeamFormColumnBg(pal.columnBg);
    setTeamFormBorderColor(pal.border);
    setTeamFormNotes('');
    setIsTeamModalOpen(true);
  };

  const openEditTeamModal = (team: FleetTeam) => {
    setEditingTeam(team);
    setTeamFormName(team.name);
    setTeamFormMachineryId(team.machineryId || '');
    setTeamFormHeaderBg(team.headerBgColor || '#fef08a');
    setTeamFormColumnBg(team.columnBgColor || '#fefce8');
    setTeamFormBorderColor(team.borderColor || '#ca8a04');
    setTeamFormNotes(team.notes || '');
    setIsTeamModalOpen(true);
  };

  const handleSaveTeamForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormName.trim()) return;

    const linkedMachinery = machineries.find(m => m.id === teamFormMachineryId);

    if (editingTeam) {
      const updated = teams.map(t =>
        t.id === editingTeam.id
          ? {
              ...t,
              name: teamFormName.trim(),
              machineryId: teamFormMachineryId || undefined,
              machineryName: linkedMachinery ? `${linkedMachinery.name} (${linkedMachinery.licensePlateOrSerial || linkedMachinery.model})` : undefined,
              headerBgColor: teamFormHeaderBg,
              columnBgColor: teamFormColumnBg,
              borderColor: teamFormBorderColor,
              notes: teamFormNotes.trim() || undefined,
            }
          : t
      );
      handleSaveTeamsList(updated);
      showToast(`Equipe "${teamFormName}" atualizada com sucesso!`);
    } else {
      const newTeam: FleetTeam = {
        id: `team_${Date.now()}`,
        name: teamFormName.trim(),
        machineryId: teamFormMachineryId || undefined,
        machineryName: linkedMachinery ? `${linkedMachinery.name} (${linkedMachinery.licensePlateOrSerial || linkedMachinery.model})` : undefined,
        headerBgColor: teamFormHeaderBg,
        columnBgColor: teamFormColumnBg,
        borderColor: teamFormBorderColor,
        notes: teamFormNotes.trim() || undefined,
        order: teams.length + 1,
        createdAt: new Date().toISOString(),
      };
      handleSaveTeamsList([...teams, newTeam]);
      showToast(`Equipe "${teamFormName}" criada com sucesso!`);
    }

    setIsTeamModalOpen(false);
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Equipe de Frota',
      message: `Deseja realmente excluir a equipe "${teamName}"?\n\nOs colaboradores vinculados serão movidos para disponíveis sem serem excluídos.`,
      confirmLabel: 'Sim, Excluir Equipe',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    // Unassign members
    const updatedEmployees = employees.map(emp =>
      emp.teamId === teamId ? { ...emp, teamId: undefined } : emp
    );
    onSaveEmployees(updatedEmployees);

    // Remove team
    const updatedTeams = teams.filter(t => t.id !== teamId);
    handleSaveTeamsList(updatedTeams);
    showToast(`Equipe "${teamName}" removida. Funcionários foram movidos para disponíveis.`);
  };


  // --- EMPLOYEE CRUD HANDLERS ---
  const openNewEmployeeModal = (presetTeamId?: string) => {
    setEditingEmployee(null);
    setEmpFormName('');
    setEmpFormRole('Operador de Ensiladeira');
    setEmpFormPhone('');
    setEmpFormTeamId(presetTeamId || (teams[0]?.id || ''));
    setEmpFormStatus('ativo');
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpFormName(emp.name);
    setEmpFormRole(emp.role);
    setEmpFormPhone(emp.phone);
    setEmpFormTeamId(emp.teamId || '');
    setEmpFormStatus(emp.status);
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployeeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empFormName.trim()) return;

    if (editingEmployee) {
      const updated = employees.map(emp =>
        emp.id === editingEmployee.id
          ? {
              ...emp,
              name: empFormName.trim(),
              role: empFormRole.trim(),
              phone: empFormPhone.trim(),
              teamId: empFormTeamId || undefined,
              status: empFormStatus,
            }
          : emp
      );
      onSaveEmployees(updated);
      showToast(`Funcionário "${empFormName}" atualizado.`);
    } else {
      const newEmp: Employee = {
        id: `emp_${Date.now()}`,
        name: empFormName.trim(),
        role: empFormRole.trim() || 'Ajudante Geral',
        phone: empFormPhone.trim(),
        teamId: empFormTeamId || undefined,
        status: empFormStatus,
        admissionDate: new Date().toISOString().split('T')[0],
      };
      onSaveEmployees([newEmp, ...employees]);
      showToast(`Novo funcionário "${empFormName}" adicionado.`);
    }

    setIsEmployeeModalOpen(false);
  };

  const handleDeleteEmployee = async (empId: string, empName: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Colaborador',
      message: `Deseja realmente remover o funcionário "${empName}" do sistema?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    onSaveEmployees(employees.filter(emp => emp.id !== empId));
    showToast(`Funcionário "${empName}" excluído.`);
  };


  // Print Preview Modal state
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  const activeCompany = useMemo(() => {
    return companyProfile || getStoredCompanyProfile();
  }, [companyProfile]);

  // Generate clean printable HTML content for Teams
  const teamsPrintHtml = useMemo(() => {
    const totalStaff = employees.filter(e => e.teamId).length;
    const unassignedCount = employees.filter(e => !e.teamId).length;

    let teamsHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:14px; font-size:8.5pt;">
        <div><strong>Total de Equipes Ativas:</strong> ${teams.length} frentes</div>
        <div><strong>Colaboradores Escalados:</strong> ${totalStaff} pessoas</div>
        <div><strong>Disponíveis no Banco:</strong> ${unassignedCount} pessoas</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(${Math.min(teams.length, 4)}, 1fr); gap: 10px; margin-bottom: 16px;">
    `;

    teams.forEach((team, idx) => {
      const teamEmployees = employees.filter(e => e.teamId === team.id);
      const machine = machineries.find(m => m.id === team.machineryId);
      const machineText = machine ? `${machine.name} (${machine.licensePlateOrSerial || machine.model})` : (team.machineryName || 'Maquinário não vinculado');

      teamsHtml += `
        <div style="border: 2px solid #0f172a; border-radius: 6px; overflow: hidden; background: #ffffff; page-break-inside: avoid;">
          <!-- Team Header -->
          <div style="background-color: ${team.headerBgColor || '#fef08a'}; padding: 6px 8px; border-bottom: 1.5px solid #0f172a; text-align: center;">
            <div style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase;">FRENTE #${idx + 1}</div>
            <div style="font-size: 13pt; font-weight: 900; color: #0f172a; margin: 1px 0;">${team.name}</div>
            <div style="font-size: 7.5pt; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              🚜 ${machineText}
            </div>
            <div style="font-size: 7pt; font-weight: bold; color: #64748b; margin-top: 2px;">
              ${teamEmployees.length} integrante(s)
            </div>
          </div>

          <!-- Members List -->
          <div style="background-color: ${team.columnBgColor || '#fefce8'}; min-height: 140px;">
      `;

      if (teamEmployees.length === 0) {
        teamsHtml += `
          <div style="padding: 14px 8px; text-align: center; font-size: 7.5pt; color: #94a3b8; font-style: italic;">
            Nenhum colaborador alocado
          </div>
        `;
      } else {
        teamEmployees.forEach((emp, empIdx) => {
          teamsHtml += `
            <div style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1; font-size: 8pt; display: flex; flex-direction: column;">
              <div style="font-weight: 800; color: #0f172a;">${emp.name}</div>
              <div style="font-size: 7.5pt; color: #475569;">${emp.role}</div>
              ${emp.phone ? `<div style="font-size: 7pt; color: #64748b;">📞 ${emp.phone}</div>` : ''}
            </div>
          `;
        });
      }

      if (team.notes) {
        teamsHtml += `
          <div style="padding: 4px 6px; background: rgba(255,255,255,0.6); border-top: 1px dashed #cbd5e1; font-size: 7pt; color: #64748b; font-style: italic;">
            Obs: ${team.notes}
          </div>
        `;
      }

      teamsHtml += `
          </div>
        </div>
      `;
    });

    teamsHtml += `</div>`;

    // Add unassigned members if any
    const unassignedMembers = employees.filter(e => !e.teamId);
    if (unassignedMembers.length > 0) {
      teamsHtml += `
        <div style="margin-top: 12px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; page-break-inside: avoid;">
          <div style="font-size: 8pt; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
            Banco de Reserva / Disponíveis (${unassignedMembers.length} pessoas):
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 7.5pt;">
            ${unassignedMembers.map(u => `
              <div style="padding: 4px 6px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px;">
                <strong>${u.name}</strong> - ${u.role} ${u.phone ? `(${u.phone})` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return teamsHtml;
  }, [teams, employees, machineries]);

  // Formats WhatsApp text message for the teams schedule
  const teamsWhatsAppText = useMemo(() => {
    const now = new Date();
    const dateStr = formatDateBR(now.toISOString().split('T')[0]);
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let text = `🚜 *${activeCompany.tradeName?.toUpperCase() || 'SILAGEM TESTE 02'}*\n`;
    text += `📋 *ESCALA DE FRENTES DE COLHEITA & SILAGEM*\n`;
    text += `📅 *Emissão:* ${dateStr} às ${timeStr}\n\n`;
    
    teams.forEach((t, idx) => {
      const teamEmps = employees.filter(e => e.teamId === t.id);
      const mach = machineries.find(m => m.id === t.machineryId);
      const machName = mach 
        ? `${mach.name} (${mach.licensePlateOrSerial || mach.model})` 
        : (t.machineryName || 'Maquinário a definir');
      
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🟢 *FRENTE #${idx + 1}: ${t.name.toUpperCase()}*\n`;
      text += `🚜 *Máquina:* ${machName}\n`;
      if (t.leaderName) text += `⭐ *Líder:* ${t.leaderName}\n`;
      text += `👥 *Integrantes (${teamEmps.length}):*\n`;
      
      if (teamEmps.length === 0) {
        text += `  _(Nenhum operador alocado nesta frente)_\n`;
      } else {
        teamEmps.forEach(e => {
          text += `  • *${e.name}* (${e.role})${e.phone ? ` 📞 ${e.phone}` : ''}\n`;
        });
      }
      
      if (t.notes) {
        text += `📝 *Obs:* ${t.notes}\n`;
      }
      text += `\n`;
    });
    
    const unassigned = employees.filter(e => !e.teamId);
    if (unassigned.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🟡 *BANCO DE RESERVA (${unassigned.length} disponíveis):*\n`;
      unassigned.forEach(u => {
        text += `  • ${u.name} - ${u.role}${u.phone ? ` (${u.phone})` : ''}\n`;
      });
      text += `\n`;
    }
    
    text += `_Emitido via Silagem Fácil Pro - Gestão Agrícola_`;
    return text;
  }, [teams, employees, machineries, activeCompany]);

  // Print handle
  const handlePrintBoard = () => {
    setIsPrintPreviewOpen(true);
  };

  return (
    <div id="fleet-teams-management" className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white dark:bg-emerald-700 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-xs font-bold border border-stone-700 animate-in slide-in-from-bottom-5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
              Escalação & Montagem de Equipes de Campo
            </h2>
          </div>
          <p className="text-xs text-[#0a0a09] dark:text-stone-400 mt-1">
            Arraste os funcionários com o mouse para transferi-los entre as frentes de trabalho (Maq 02, Maq 03, etc.), crie ou edite equipes livremente.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Toggle View Mode */}
          <div className="bg-stone-100 dark:bg-stone-800 p-1 rounded-xl flex items-center border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setViewMode('table')}
              title="Modo Tabela / Planilha (como no print)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Modo Planilha</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              title="Modo Cards Detalhados"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Modo Cards</span>
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrintBoard}
            title="Imprimir escala de equipes com logotipo oficial"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-stone-800 hover:bg-stone-50 text-stone-700 dark:text-stone-300 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-stone-600 dark:text-stone-300" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          {/* WhatsApp Share Button */}
          <button
            onClick={() => setIsPrintPreviewOpen(true)}
            title="Enviar escala de equipes por WhatsApp"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Add Employee Button */}
          <button
            onClick={() => openNewEmployeeModal()}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Novo Funcionário</span>
          </button>

          {/* Add Team Button */}
          <button
            onClick={openNewTeamModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Nova Equipe</span>
          </button>
        </div>
      </div>

      {/* Interactive Helper Banner */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
        <div className="flex items-center space-x-2.5">
          <span className="text-base">💡</span>
          <div>
            <span className="font-bold">Dica de Gestão: </span>
            <span>Clique e arraste qualquer funcionário com o mouse para a coluna da equipe desejada. Você pode renomear as equipes, trocar as cores ou adicionar mais frentes de colheita.</span>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nome ou função..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* MAIN TEAMS BOARD CONTAINER (EXACT STYLE OF SPREADSHEET IN PRINT) */}
      <div className="overflow-x-auto pb-4">
        
        {/* Outer Frame with border matching user's image */}
        <div className="min-w-[760px] border-3 border-black dark:border-stone-700 rounded-lg overflow-hidden shadow-md bg-white dark:bg-stone-950">
          
          {/* 1. TOP HEADER: "Equipes" (Matching the print banner) */}
          <div className="bg-[#ffedd5] dark:bg-amber-950 text-stone-950 dark:text-amber-100 py-2.5 px-4 border-b-3 border-black dark:border-stone-700 text-center relative flex items-center justify-center">
            <h3 className="text-base sm:text-lg font-black tracking-wide font-['Outfit']">
              Equipes de Silagem & Colheita
            </h3>
            <span className="absolute right-4 text-xs font-bold text-stone-600 dark:text-amber-300 hidden sm:inline">
              Total: {employees.length} Integrantes em {teams.length} Frentes
            </span>
          </div>

          {/* 2. TEAMS COLUMNS HEADER & GRID */}
          <div 
            className="grid divide-x-3 divide-black dark:divide-stone-700"
            style={{
              gridTemplateColumns: `repeat(${teams.length}, minmax(180px, 1fr))`
            }}
          >
            {teams.map((team, idx) => {
              const teamMembers = teamEmployeesMap[team.id] || [];
              const isDragOver = dragOverTeamId === team.id;

              return (
                <div
                  key={team.id}
                  onDragOver={(e) => handleDragOver(e, team.id)}
                  onDragLeave={(e) => handleDragLeave(e, team.id)}
                  onDrop={(e) => handleDrop(e, team.id)}
                  className={`flex flex-col transition-colors duration-150 ${
                    isDragOver ? 'ring-4 ring-inset ring-amber-500 bg-amber-100 dark:bg-amber-950' : ''
                  }`}
                  style={{
                    backgroundColor: isDragOver ? undefined : team.columnBgColor || '#fefce8'
                  }}
                >
                  {/* Column Header: "Maq 02", "Maq 03", etc. */}
                  <div
                    className="p-2.5 border-b-3 border-black dark:border-stone-700 flex flex-col justify-between items-center text-center select-none"
                    style={{
                      backgroundColor: team.headerBgColor || '#fef08a',
                      color: '#000000'
                    }}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-black/60">
                        Frente #{idx + 1}
                      </span>
                      
                      {/* Action buttons (Edit / Delete Team) */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => openEditTeamModal(team)}
                          title="Editar Equipe / Cor / Máquina"
                          className="p-1 hover:bg-black/10 rounded-md text-black transition cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          title="Excluir Equipe"
                          className="p-1 hover:bg-rose-500/20 text-rose-800 rounded-md transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-black tracking-tight my-0.5 font-['Outfit']">
                      {team.name}
                    </h4>

                    {team.machineryName && (
                      <span className="text-[11px] font-semibold text-black/75 truncate max-w-full px-1">
                        🚜 {team.machineryName}
                      </span>
                    )}

                    <div className="mt-1 flex items-center justify-between w-full text-[10px] font-bold text-black/70 border-t border-black/15 pt-1">
                      <span>{teamMembers.length} pessoas</span>
                      <button
                        onClick={() => openNewEmployeeModal(team.id)}
                        title="Adicionar pessoa nesta equipe"
                        className="flex items-center space-x-0.5 hover:text-black transition cursor-pointer underline"
                      >
                        <Plus className="w-3 h-3 inline" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Drop Area Indicator when dragging */}
                  {isDragOver && (
                    <div className="p-3 m-2 border-2 border-dashed border-black dark:border-amber-400 rounded-lg text-center text-xs font-black text-black dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 animate-pulse">
                      Solte aqui para mover para {team.name}
                    </div>
                  )}

                  {/* EMPLOYEES ROWS / CELLS */}
                  <div className="flex-1 divide-y-2 divide-black/40 dark:divide-stone-700 min-h-[360px]">
                    {teamMembers.length === 0 ? (
                      <div className="p-6 text-center text-xs font-semibold text-stone-500 dark:text-stone-400 italic">
                        Nenhum funcionário escalado.<br />
                        <span className="text-[11px] font-normal text-stone-400">
                          Arraste alguém para cá
                        </span>
                      </div>
                    ) : (
                      teamMembers.map((member, memberIdx) => {
                        const isBeingDragged = draggedEmployeeId === member.id;

                        if (viewMode === 'table') {
                          // --- SPREADSHEET TABLE ROW (EXACTLY AS IN USER'S PRINT) ---
                          return (
                            <div
                              key={member.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, member.id)}
                              onDragEnd={handleDragEnd}
                              className={`group px-3 py-2 flex items-center justify-between text-xs transition cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/10 select-none ${
                                isBeingDragged ? 'opacity-40 bg-stone-300' : ''
                              }`}
                              style={{ color: '#000000' }}
                            >
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <GripVertical className="w-3.5 h-3.5 text-black/40 group-hover:text-black shrink-0" />
                                <div className="truncate">
                                  <span className="font-bold text-xs text-black block truncate">
                                    {member.name}
                                  </span>
                                  <span className="text-[10px] text-black/70 block truncate leading-tight">
                                    {member.role}
                                  </span>
                                </div>
                              </div>

                              {/* Row Action Buttons */}
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                                <button
                                  onClick={() => openEditEmployeeModal(member)}
                                  title="Editar Funcionário"
                                  className="p-1 hover:bg-black/10 rounded text-black transition"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                
                                {/* Quick Move to Other Team button */}
                                <div className="relative">
                                  <button
                                    onClick={() => setOpenMoveMenuEmpId(openMoveMenuEmpId === member.id ? null : member.id)}
                                    title="Mover para outra equipe"
                                    className="p-1 hover:bg-black/10 rounded text-black transition"
                                  >
                                    <MoveRight className="w-3 h-3" />
                                  </button>

                                  {/* Quick move dropdown popover */}
                                  {openMoveMenuEmpId === member.id && (
                                    <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl shadow-xl p-1 text-xs animate-in fade-in">
                                      <div className="px-2 py-1 text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">
                                        Mover para:
                                      </div>
                                      {teams.map(t => (
                                        <button
                                          key={t.id}
                                          disabled={t.id === team.id}
                                          onClick={() => handleDirectMove(member.id, t.id)}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs font-semibold cursor-pointer ${
                                            t.id === team.id
                                              ? 'opacity-40 bg-stone-100 dark:bg-stone-800'
                                              : 'hover:bg-emerald-50 dark:hover:bg-emerald-950 text-stone-900 dark:text-stone-100'
                                          }`}
                                        >
                                          <span>{t.name}</span>
                                          {t.id === team.id && <Check className="w-3 h-3 text-emerald-600" />}
                                        </button>
                                      ))}
                                      <div className="border-t border-stone-200 dark:border-stone-800 my-1"></div>
                                      <button
                                        onClick={() => handleDirectMove(member.id, 'unassigned')}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-xs font-bold"
                                      >
                                        Banco de Disponíveis
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // --- RICH KANBAN CARD VIEW ---
                        return (
                          <div
                            key={member.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, member.id)}
                            onDragEnd={handleDragEnd}
                            className={`p-3 bg-white/90 dark:bg-stone-900/90 m-2 rounded-xl border border-stone-300 dark:border-stone-700 shadow-xs hover:border-black transition cursor-grab active:cursor-grabbing ${
                              isBeingDragged ? 'opacity-40 scale-95' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <GripVertical className="w-4 h-4 text-stone-400 shrink-0" />
                                <div>
                                  <h5 className="font-bold text-xs text-stone-900 dark:text-stone-100">
                                    {member.name}
                                  </h5>
                                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    {member.role}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => openEditEmployeeModal(member)}
                                  className="p-1 text-stone-400 hover:text-stone-900 dark:hover:text-white rounded"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {member.phone && (
                              <div className="mt-2 text-[10px] text-stone-500 flex items-center space-x-1">
                                <Phone className="w-3 h-3 text-stone-400" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. UNASSIGNED / POOL EMPLOYEES DRAWER */}
      <div 
        onDragOver={(e) => handleDragOver(e, 'unassigned')}
        onDragLeave={(e) => handleDragLeave(e, 'unassigned')}
        onDrop={(e) => handleDrop(e, 'unassigned')}
        className={`bg-white dark:bg-stone-900 rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
          dragOverTeamId === 'unassigned'
            ? 'border-amber-500 ring-4 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/40'
            : 'border-stone-200 dark:border-stone-800'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300">
              {unassignedEmployees.length}
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Banco de Funcionários Disponíveis / Sem Equipe
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Arraste daqui para qualquer equipe acima, ou solte aqui para retirar de uma equipe
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => openNewEmployeeModal()}
              className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Adicionar ao Banco</span>
            </button>
            <button
              onClick={() => setIsUnassignedOpen(!isUnassignedOpen)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer"
            >
              {isUnassignedOpen ? 'Ocultar' : 'Exibir'}
            </button>
          </div>
        </div>

        {isUnassignedOpen && (
          <div className="p-4">
            {unassignedEmployees.length === 0 ? (
              <div className="text-center py-6 text-xs text-stone-400 italic">
                Todos os funcionários estão alocados em equipes. Para disponibilizar alguém, arraste-o para cá.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {unassignedEmployees.map((member) => (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, member.id)}
                    onDragEnd={handleDragEnd}
                    className="p-3 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between hover:border-emerald-500 transition cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-stone-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-xs text-stone-900 dark:text-stone-100 block truncate">
                          {member.name}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">
                          {member.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <button
                        onClick={() => openEditEmployeeModal(member)}
                        className="p-1 text-stone-400 hover:text-stone-900 dark:hover:text-white rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setOpenMoveMenuEmpId(openMoveMenuEmpId === member.id ? null : member.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition"
                          title="Alocar em uma equipe"
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </button>

                        {openMoveMenuEmpId === member.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-44 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl shadow-xl p-1 text-xs animate-in fade-in">
                            <div className="px-2 py-1 text-[10px] font-bold text-stone-500 uppercase">
                              Alocar na Equipe:
                            </div>
                            {teams.map(t => (
                              <button
                                key={t.id}
                                onClick={() => handleDirectMove(member.id, t.id)}
                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-stone-900 dark:text-stone-100 text-xs font-semibold cursor-pointer"
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: CRIAR / EDITAR EQUIPE */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-900 text-white dark:bg-emerald-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-400 dark:text-white" />
                <h3 className="text-base font-bold font-['Outfit']">
                  {editingTeam ? `Editar Equipe: ${editingTeam.name}` : 'Criar Nova Equipe'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeamForm} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Nome da Equipe <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={teamFormName}
                  onChange={(e) => setTeamFormName(e.target.value)}
                  placeholder="Ex: Maq 06, Equipe Noturna, Frente Silagem 02..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Máquina / Veículo Principal Vinculado (Opcional)
                </label>
                <select
                  value={teamFormMachineryId}
                  onChange={(e) => setTeamFormMachineryId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">-- Nenhuma máquina vinculada --</option>
                  {machineries.map(m => (
                    <option key={m.id} value={m.id}>
                      🚜 {m.licensePlateOrSerial || m.name} - {m.model} ({m.brand})
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Scheme Picker */}
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Esquema de Cores da Coluna
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEAM_COLOR_PALETTES.map(pal => {
                    const isSelected = teamFormHeaderBg === pal.headerBg;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => {
                          setTeamFormHeaderBg(pal.headerBg);
                          setTeamFormColumnBg(pal.columnBg);
                          setTeamFormBorderColor(pal.border);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between text-left transition cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-emerald-600 border-emerald-600 font-bold shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 hover:border-stone-400'
                        }`}
                        style={{ backgroundColor: pal.columnBg }}
                      >
                        <div
                          className="w-full py-1 px-1.5 rounded text-[10px] font-black text-black text-center mb-1"
                          style={{ backgroundColor: pal.headerBg }}
                        >
                          {pal.name.split(' ')[0]}
                        </div>
                        <span className="text-[10px] text-stone-700 truncate w-full text-center">
                          {pal.name.includes('(') ? pal.name.split('(')[1].replace(')', '') : pal.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Notas / Instruções da Equipe
                </label>
                <textarea
                  rows={2}
                  value={teamFormNotes}
                  onChange={(e) => setTeamFormNotes(e.target.value)}
                  placeholder="Ex: Operação diurna focada no corte de milho com alta umidade."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingTeam ? 'Salvar Alterações' : 'Criar Equipe'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CRIAR / EDITAR FUNCIONÁRIO */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold font-['Outfit']">
                  {editingEmployee ? `Editar: ${editingEmployee.name}` : 'Novo Funcionário'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeForm} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={empFormName}
                  onChange={(e) => setEmpFormName(e.target.value)}
                  placeholder="Ex: Funcionario 33 / Nome Completo"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Função / Cargo
                </label>
                <input
                  type="text"
                  list="roles-suggestions-list"
                  value={empFormRole}
                  onChange={(e) => setEmpFormRole(e.target.value)}
                  placeholder="Ex: Operador de Ensiladeira"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <datalist id="roles-suggestions-list">
                  <option value="Operador de Ensiladeira Claas" />
                  <option value="Operador de Ensiladeira JD" />
                  <option value="Motorista de Caminhão Caçamba" />
                  <option value="Tratorista de Compactação" />
                  <option value="Tratorista de Corte & Arrasto" />
                  <option value="Ajudante de Enlonamento e Lacre" />
                  <option value="Mecânico de Campo" />
                  <option value="Apoio Geral de Silo" />
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Equipe de Alocação
                </label>
                <select
                  value={empFormTeamId}
                  onChange={(e) => setEmpFormTeamId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">-- Banco de Disponíveis (Sem Equipe) --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.machineryName ? `(${t.machineryName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={empFormPhone}
                    onChange={(e) => setEmpFormPhone(e.target.value)}
                    placeholder="(45) 99999-9999"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={empFormStatus}
                    onChange={(e) => setEmpFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="ferias">Férias</option>
                    <option value="afastado">Afastado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                {editingEmployee ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEmployee(editingEmployee.id, editingEmployee.name)}
                    className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal with Official Company Logo & Data */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        options={{
          title: 'Escalação & Alocação de Frentes de Colheita e Silagem',
          subtitle: 'Ordem de serviço de campo, equipes operacionais e maquinários vinculados',
          documentType: 'ESCALA DE FRENTES DE CAMPO',
          company: activeCompany,
          contentHtml: teamsPrintHtml,
          orientation: 'landscape',
          signatureLabels: ['Encarregado de Frentes / Silagem', 'Gerência Agrícola / Frotas'],
          whatsappText: teamsWhatsAppText,
        }}
      />

    </div>
  );
};
