import { Machinery, Employee, ServiceTruckItem } from '../../types';

export const isForrageira = (m: Machinery): boolean => {
  const cat = (m.categoryType || '').toLowerCase();
  const name = (m.name || '').toLowerCase();
  const model = (m.model || '').toLowerCase();
  if (cat.includes('caminhao') || cat.includes('caminhão') || cat.includes('trator')) return false;
  return (
    cat.includes('forrageira') ||
    cat.includes('ensiladeira') ||
    name.includes('forrageira') ||
    name.includes('ensiladeira') ||
    model.includes('claas') ||
    model.includes('jaguar') ||
    model.includes('forrageira')
  );
};

export const isTrator = (m: Machinery): boolean => {
  const cat = (m.categoryType || '').toLowerCase();
  const name = (m.name || '').toLowerCase();
  const model = (m.model || '').toLowerCase();
  if (cat.includes('caminhao') || cat.includes('caminhão') || cat.includes('forrageira') || cat.includes('ensiladeira')) return false;
  return (
    cat.includes('trator') ||
    name.includes('trator') ||
    model.includes('trator') ||
    name.includes('7200j') ||
    name.includes('8030') ||
    name.includes('7815') ||
    name.includes('new holland') ||
    name.includes('massey')
  );
};

export const isCaminhao = (m: Machinery): boolean => {
  const cat = (m.categoryType || '').toLowerCase();
  const name = (m.name || '').toLowerCase();
  const model = (m.model || '').toLowerCase();
  if (cat.includes('trator') || cat.includes('forrageira') || cat.includes('ensiladeira')) return false;
  return (
    cat.includes('caminhao') ||
    cat.includes('caminhão') ||
    name.includes('caminhao') ||
    name.includes('caminhão') ||
    ((m.capacityM3 || 0) > 0)
  );
};

export const findLinkedOperator = (m: Machinery | undefined | null, employees: Employee[] = []): { id: string; name: string } => {
  if (!m) return { id: '', name: '' };

  // 1. Verifica IDs de motoristas vinculados no cadastro da frota (assignedDriverIds)
  if (Array.isArray(m.assignedDriverIds) && m.assignedDriverIds.length > 0) {
    for (const dId of m.assignedDriverIds) {
      if (dId && typeof dId === 'string') {
        const emp = employees.find((e) => e.id === dId);
        if (emp) return { id: emp.id, name: emp.name };
      }
    }
  }

  // 2. Verifica lista de nomes de motoristas vinculados (assignedDrivers)
  if (Array.isArray(m.assignedDrivers) && m.assignedDrivers.length > 0) {
    for (const dName of m.assignedDrivers) {
      if (dName && typeof dName === 'string' && dName.trim()) {
        const cleanName = dName.trim();
        const emp = employees.find((e) => e.name.toLowerCase() === cleanName.toLowerCase());
        if (emp) return { id: emp.id, name: emp.name };
        return { id: '', name: cleanName };
      }
    }
  }

  // 3. Verifica campo de texto 'operatorOrDriver' (inclui Terceirizados / Prestadores / Motorista Fixo)
  if (m.operatorOrDriver && typeof m.operatorOrDriver === 'string' && m.operatorOrDriver.trim()) {
    const raw = m.operatorOrDriver.trim();
    const primaryName = raw.split(/[,;/]/)[0].trim();
    const emp = employees.find(
      (e) =>
        e.name.toLowerCase() === raw.toLowerCase() ||
        e.name.toLowerCase() === primaryName.toLowerCase() ||
        raw.toLowerCase().includes(e.name.toLowerCase()) ||
        e.name.toLowerCase().includes(raw.toLowerCase())
    );
    if (emp) return { id: emp.id, name: emp.name };
    return { id: '', name: primaryName || raw };
  }

  return { id: '', name: '' };
};

export const formatEmployeeOptionLabel = (emp: Employee): string => {
  let commissionStr = '';
  if (emp.receivesCommission) {
    if (emp.commissionPerHour && emp.commissionPerHour > 0) {
      commissionStr = ` — R$ ${emp.commissionPerHour.toFixed(2).replace('.', ',')}/h`;
    } else if (emp.commissionPerHectare && emp.commissionPerHectare > 0) {
      commissionStr = ` — R$ ${emp.commissionPerHectare.toFixed(2).replace('.', ',')}/ha`;
    } else if (emp.commissionPerAlqueire && emp.commissionPerAlqueire > 0) {
      commissionStr = ` — R$ ${emp.commissionPerAlqueire.toFixed(2).replace('.', ',')}/alq`;
    }
  }
  const roleLabel = emp.registrationType === 'Prestador de Serviço' 
    ? 'Terceirizado' 
    : (emp.role || 'Operador');
  return `${emp.name} (${roleLabel})${commissionStr}`;
};

export const formatMachineryOptionLabel = (m: Machinery): string => {
  const plate = m.licensePlateOrSerial ? m.licensePlateOrSerial.trim().toUpperCase() : '';
  const nameOrModel = (m.name || m.model || 'Equipamento').toUpperCase();
  const brandUpper = (m.brand || '').trim().toUpperCase();
  const isBrandDuplicated = brandUpper && (
    nameOrModel.includes(brandUpper) ||
    (brandUpper === 'CLASS' && (nameOrModel.includes('CLASS') || nameOrModel.includes('CLAAS'))) ||
    (brandUpper === 'CLAAS' && (nameOrModel.includes('CLASS') || nameOrModel.includes('CLAAS')))
  );
  const brand = brandUpper && !isBrandDuplicated ? ` (${brandUpper})` : '';
  const cap = m.capacityM3 && m.capacityM3 > 0 ? ` [${m.capacityM3} m³]` : '';
  
  if (plate) {
    return `${plate} — ${nameOrModel}${brand}${cap}`;
  }
  return `${nameOrModel}${brand}${cap}`;
};

export const formatTruckOptionLabel = (m: Machinery): string => {
  const plate = m.licensePlateOrSerial ? m.licensePlateOrSerial.trim().toUpperCase() : '';
  const nameOrModel = (m.name || m.model || 'Caminhão').toUpperCase();
  const brand = m.brand ? ` (${m.brand.toUpperCase()})` : '';
  const cap = m.capacityM3 && m.capacityM3 > 0 ? ` [${m.capacityM3} m³]` : '';
  const ownLower = (m.ownership || '').toLowerCase();
  const ownBadge = (ownLower === 'terceirizado' || ownLower.includes('terceir') || ownLower.includes('terceiro'))
    ? ' [DE TERCEIRO]'
    : '';
  if (plate) {
    return `${plate} — ${nameOrModel}${brand}${cap}${ownBadge}`;
  }
  return `${nameOrModel}${brand}${cap}${ownBadge}`;
};

export const isThirdPartyTruck = (
  truck: Partial<ServiceTruckItem>,
  machineries: Machinery[] = [],
  employees: Employee[] = []
): boolean => {
  if (!truck) return false;

  // 1. Verificação explícita da propriedade gravada no caminhão
  const ownDirect = ((truck as any).ownership || '').toLowerCase().trim();
  if (ownDirect === 'terceirizado' || ownDirect.includes('terceir') || ownDirect.includes('terceiro')) {
    return true;
  }

  // 2. Busca na frota / maquinários cadastrados
  const mach = machineries.find((m) => m.id === truck.machineryId);
  if (mach) {
    const machOwn = (mach.ownership || '').toLowerCase().trim();
    if (machOwn === 'terceirizado' || machOwn.includes('terceir') || machOwn.includes('terceiro')) {
      return true;
    }
    const machName = (mach.name || '').toLowerCase();
    const machModel = (mach.model || '').toLowerCase();
    const machNotes = (mach.notes || '').toLowerCase();
    const machOwner = (mach.ownerName || '').toLowerCase();
    if (
      machName.includes('terceir') ||
      machModel.includes('terceir') ||
      machNotes.includes('terceir') ||
      machOwner.includes('terceir')
    ) {
      return true;
    }
  }

  // 3. Nome do caminhão digitado ou selecionado
  const nameToCheck = (truck.truckName || '').toLowerCase();
  if (nameToCheck.includes('terceir') || nameToCheck.includes('terceiro')) {
    return true;
  }

  // 4. Motorista vinculado (se for colaborador classificado como terceirizado ou freteiro)
  const driver = employees.find(
    (e) => e.id === truck.primaryDriverId || e.name.toLowerCase() === (truck.primaryDriverName || '').toLowerCase()
  );
  if (driver) {
    const contract = (driver.contractType || '').toLowerCase().trim();
    const regType = (driver.registrationType || '').toLowerCase().trim();
    const role = (driver.role || '').toLowerCase().trim();
    if (
      contract.includes('terceir') ||
      regType.includes('terceir') ||
      role.includes('terceir') ||
      role.includes('freteiro')
    ) {
      return true;
    }
  }

  const driverName = (truck.primaryDriverName || '').toLowerCase();
  if (driverName.includes('terceir') || driverName.includes('freteiro')) {
    return true;
  }

  return false;
};

export const isBrokerEmployee = (emp?: Partial<Employee>): boolean => {
  if (!emp) return false;
  const roleStr = (emp.role || '').toLowerCase();
  const rolesList = Array.isArray(emp.roles) ? emp.roles.map(r => r.toLowerCase()) : [];
  const regTypeStr = (emp.registrationType || '').toLowerCase();
  return roleStr.includes('agenciador') || rolesList.some(r => r.includes('agenciador')) || regTypeStr.includes('agenciador');
};
