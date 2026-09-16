import { Machinery, CompanyProfile, FuelLog, MaintenanceLog, ServiceOrder, SilageOrder } from '../../types';

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '--';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Generates an executive, printable A4 HTML report for the fleet list.
 */
export function generateFleetListHtml(
  machineries: Machinery[],
  company?: CompanyProfile,
  filterInfo?: { category?: string; status?: string; search?: string }
): string {
  const companyName = company?.tradeName || company?.corporateName || 'Silagem Fácil - Gestão Agropecuária';
  const companyCnpj = company?.cnpjCpf ? `CNPJ/CPF: ${company.cnpjCpf}` : '';
  const companyPhone = company?.phone ? `Tel: ${company.phone}` : '';
  const companyEmail = company?.email ? `E-mail: ${company.email}` : '';
  const companyAddress = company?.address 
    ? `${company.address}${company.city ? ` - ${company.city}/${company.state || ''}` : ''}`
    : '';

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Summary Metrics
  const totalVehicles = machineries.length;
  const propriosCount = machineries.filter(m => !m.ownership || m.ownership === 'proprio' || m.ownership.toLowerCase().includes('próprio') || m.ownership.toLowerCase().includes('proprio')).length;
  const terceirosCount = machineries.filter(m => m.ownership && (m.ownership === 'terceirizado' || m.ownership.toLowerCase().includes('terceir'))).length;
  const operacionaisCount = machineries.filter(m => m.status === 'operacional').length;
  const emManutencaoCount = machineries.filter(m => m.status === 'em_manutencao').length;
  const cavalosCount = machineries.filter(m => m.compositionType === 'cavalo').length;
  const reboquesCount = machineries.filter(m => m.compositionType === 'reboque' || m.categoryType === 'reboque').length;
  const tratoresCount = machineries.filter(m => m.categoryType === 'trator').length;
  const ensiladeirasCount = machineries.filter(m => m.categoryType === 'ensiladeira' || m.categoryType === 'forrageira').length;

  const totalHourMeters = machineries.reduce((acc, m) => acc + (m.hourMeter || 0), 0);
  const totalKm = machineries.reduce((acc, m) => acc + (m.currentKm || 0), 0);

  const rowsHtml = machineries.map((v, index) => {
    const isCavalo = v.compositionType === 'cavalo';
    const isReboque = v.compositionType === 'reboque' || v.categoryType === 'reboque';
    const trailerEngatado = isCavalo && (v.coupledTrailerName || v.coupledTrailerId)
      ? `<span class="trailer-badge">Engatado: ${v.coupledTrailerName || 'Reboque vinculado'}</span>`
      : '';

    const composicaoLabel = isCavalo 
      ? `Cavalo Mecânico ${trailerEngatado}`
      : isReboque 
      ? 'Reboque / Carreta'
      : (v.compositionType === 'veiculo_simples' ? 'Veículo Individual' : 'Máquina / Trator');

    const tipoLabel = v.vehicleTypeDetailed || v.categoryType || 'Equipamento';

    // Propriedade & No Nome de Quem
    const ownershipLabel = 
      v.ownership === 'proprio' ? 'Próprio' :
      v.ownership === 'terceirizado' ? 'De Terceiros' :
      v.ownership === 'alugado' ? 'Alugado' :
      v.ownership === 'arrendado' ? 'Arrendado' : (v.ownership || 'Próprio');

    const ownerInfo = v.ownerName 
      ? `<div class="owner-name"><strong>${v.ownerName}</strong></div>` +
        (v.ownerDocument ? `<div class="owner-doc">Doc: ${v.ownerDocument}</div>` : '') +
        (v.secondaryOwnerName ? `<div class="owner-sec">Sócio: ${v.secondaryOwnerName}</div>` : '')
      : '<span class="text-muted">Não informado</span>';

    // Pesos: Tara, Lotação e PBT
    const tara = v.taraWeightKg ? `${v.taraWeightKg.toLocaleString('pt-BR')} kg` : '--';
    const lotacao = v.capacityLoadKg ? `${v.capacityLoadKg.toLocaleString('pt-BR')} kg` : (v.capacityM3 ? `${v.capacityM3} m³` : '--');
    const pbt = (v.taraWeightKg && v.capacityLoadKg) 
      ? `${((v.taraWeightKg + v.capacityLoadKg)).toLocaleString('pt-BR')} kg` 
      : (v.grossWeightKg ? `${v.grossWeightKg.toLocaleString('pt-BR')} kg` : '--');

    // Horímetro & KM
    const horimetroStr = v.hourMeter ? `${v.hourMeter.toLocaleString('pt-BR')} h` : '';
    const kmStr = v.currentKm ? `${v.currentKm.toLocaleString('pt-BR')} km` : '';
    const meterStr = [horimetroStr, kmStr].filter(Boolean).join(' | ') || '--';

    // Motoristas
    const motoristas = v.assignedDrivers && v.assignedDrivers.length > 0
      ? v.assignedDrivers.join(', ')
      : (v.operatorOrDriver || '--');

    const statusBadgeClass = v.status === 'operacional' ? 'status-operacional' :
      v.status === 'em_manutencao' ? 'status-manutencao' :
      v.status === 'parado' ? 'status-parado' : 'status-disponivel';

    const statusLabel = v.status === 'operacional' ? 'Operacional' :
      v.status === 'em_manutencao' ? 'Em Manutenção' :
      v.status === 'parado' ? 'Parado' : 'Disponível';

    return `
      <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="col-plate">
          <div class="plate-box">${v.licensePlateOrSerial || '--'}</div>
          ${v.serialNumber ? `<div class="serial-text">Nº Série: <strong>${v.serialNumber}</strong></div>` : ''}
          ${v.renavam ? `<div class="renavam-text">RENAVAM: ${v.renavam}</div>` : ''}
        </td>
        <td class="col-vehicle">
          <div class="vehicle-model">${v.model || v.name}</div>
          <div class="vehicle-sub">${v.brand || 'Agrícola'} ${v.year ? `• Ano ${v.year}` : ''} ${v.color ? `• ${v.color}` : ''}</div>
          <div class="type-badge">${tipoLabel}</div>
        </td>
        <td class="col-comp">
          <div class="comp-box">${composicaoLabel}</div>
        </td>
        <td class="col-owner">
          <span class="ownership-chip ${v.ownership === 'proprio' ? 'chip-proprio' : 'chip-terceiros'}">${ownershipLabel}</span>
          <div class="mt-1">${ownerInfo}</div>
        </td>
        <td class="col-weights">
          <div class="weight-item"><span>Tara:</span> <strong>${tara}</strong></div>
          <div class="weight-item"><span>Lotação:</span> <strong>${lotacao}</strong></div>
          <div class="weight-item pbt"><span>PBT:</span> <strong>${pbt}</strong></div>
        </td>
        <td class="col-meters font-mono">
          ${v.hourMeter ? `<div class="text-amber">⏱ ${v.hourMeter.toLocaleString('pt-BR')} h</div>` : ''}
          ${v.currentKm ? `<div class="text-emerald">🚗 ${v.currentKm.toLocaleString('pt-BR')} km</div>` : ''}
          ${!v.hourMeter && !v.currentKm ? '<div class="text-muted">--</div>' : ''}
        </td>
        <td class="col-driver">
          <div class="driver-text">${motoristas}</div>
        </td>
        <td class="col-status text-center">
          <span class="status-chip ${statusBadgeClass}">${statusLabel}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="fleet-print-document">
      <style>
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 10mm 8mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1c1917;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .fleet-table {
            page-break-inside: auto;
          }
          .fleet-table thead {
            display: table-header-group;
            page-break-after: avoid;
            break-after: avoid;
          }
          .fleet-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .kpi-container {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .kpi-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }

        .fleet-print-document {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #1c1917;
          background: #ffffff;
          padding: 0;
          line-height: 1.35;
          font-size: 11px;
        }

        /* KPI SUMMARY CARDS (Linha horizontal com 6 cards) */
        .kpi-container {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 14px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 8px;
          text-align: center;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .kpi-val {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
        }
        .kpi-lbl {
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        /* TABLE */
        .fleet-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
          margin-bottom: 14px;
          table-layout: auto;
        }
        .fleet-table thead {
          display: table-header-group;
        }
        .fleet-table th {
          background: #0963cb;
          color: #ffffff;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 8.5px;
          letter-spacing: 0.4px;
          padding: 6px 6px;
          border: 1px solid #074fa3;
          text-align: left;
        }
        .fleet-table tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .fleet-table td {
          padding: 4px 6px;
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .row-even { background: #ffffff; }
        .row-odd { background: #f8fafc; }

        .plate-box {
          display: inline-block;
          font-family: monospace;
          font-weight: 800;
          font-size: 10.5px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 1px 4px;
          border-radius: 4px;
          color: #0f172a;
        }
        .serial-text {
          font-size: 8.5px;
          color: #475569;
          margin-top: 2px;
        }
        .renavam-text {
          font-size: 8px;
          color: #94a3b8;
          font-family: monospace;
        }
        .vehicle-model {
          font-weight: 700;
          color: #0f172a;
          font-size: 10px;
        }
        .vehicle-sub {
          font-size: 8.5px;
          color: #64748b;
        }
        .type-badge {
          display: inline-block;
          font-size: 8px;
          font-weight: 700;
          color: #0284c7;
          background: #e0f2fe;
          border-radius: 3px;
          padding: 0 4px;
          margin-top: 2px;
        }
        .trailer-badge {
          display: block;
          font-size: 8px;
          font-weight: 700;
          color: #b45309;
          background: #fef3c7;
          border-radius: 3px;
          padding: 1px 3px;
          margin-top: 2px;
          width: fit-content;
        }
        .comp-box {
          font-size: 9px;
          font-weight: 600;
        }
        .ownership-chip {
          display: inline-block;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .chip-proprio {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .chip-terceiros {
          background: #fef9c3;
          color: #a16207;
          border: 1px solid #fef08a;
        }
        .owner-name {
          font-size: 9px;
          color: #0f172a;
        }
        .owner-doc {
          font-size: 8px;
          color: #64748b;
          font-family: monospace;
        }
        .owner-sec {
          font-size: 8px;
          color: #64748b;
          font-style: italic;
        }
        .weight-item {
          font-size: 8.5px;
          color: #475569;
        }
        .weight-item.pbt {
          font-weight: 800;
          color: #0369a1;
          border-top: 1px dashed #cbd5e1;
          padding-top: 1px;
          margin-top: 1px;
        }
        .text-amber { color: #b45309; font-weight: 700; }
        .text-emerald { color: #047857; font-weight: 700; }
        .text-muted { color: #94a3b8; font-style: italic; }

        .driver-text {
          font-size: 9px;
          color: #334155;
          max-width: 130px;
          line-height: 1.2;
        }

        .status-chip {
          display: inline-block;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 10px;
        }
        .status-operacional {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }
        .status-manutencao {
          background: #e0e7ff;
          color: #3730a3;
          border: 1px solid #c7d2fe;
        }
        .status-parado {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        .status-disponivel {
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
        }
      </style>

      <!-- KPI SUMMARY CARDS -->
      <div class="kpi-container">
        <div class="kpi-card">
          <div class="kpi-val">${totalVehicles}</div>
          <div class="kpi-lbl">Total de Veículos</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color: #166534;">${propriosCount}</div>
          <div class="kpi-lbl">Veículos Próprios</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color: #a16207;">${terceirosCount}</div>
          <div class="kpi-lbl">De Terceiros</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color: #0284c7;">${cavalosCount} Cav / ${reboquesCount} Reb</div>
          <div class="kpi-lbl">Composições</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color: #b45309;">${totalHourMeters.toLocaleString('pt-BR')} h</div>
          <div class="kpi-lbl">Horímetro Acumulado</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color: #047857;">${totalKm.toLocaleString('pt-BR')} km</div>
          <div class="kpi-lbl">KM Acumulado</div>
        </div>
      </div>

      <!-- MAIN TABLE -->
      <table class="fleet-table">
        <thead>
          <tr>
            <th style="width: 14%;">Identificação / Placa</th>
            <th style="width: 16%;">Marca / Modelo / Tipo</th>
            <th style="width: 13%;">Composição</th>
            <th style="width: 17%;">Propriedade & Titular</th>
            <th style="width: 13%;">Pesos (Tara/Lotação)</th>
            <th style="width: 11%;">Horímetro / Odômetro</th>
            <th style="width: 10%;">Motoristas</th>
            <th style="width: 6%; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhum veículo registrado na frota.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * WhatsApp formatted summary for sharing
 */
export function generateFleetWhatsAppText(machineries: Machinery[], company?: CompanyProfile): string {
  const companyName = company?.tradeName || company?.corporateName || 'Silagem Fácil';
  const total = machineries.length;
  const proprios = machineries.filter(m => m.ownership === 'proprio' || !m.ownership).length;
  const terceiros = machineries.filter(m => m.ownership === 'terceirizado').length;
  const operacionais = machineries.filter(m => m.status === 'operacional').length;
  const emManutencao = machineries.filter(m => m.status === 'em_manutencao').length;

  let text = `📋 *RELATÓRIO RESUMIDO DE FROTAS - ${companyName.toUpperCase()}*\n`;
  text += `📅 Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n`;
  text += `🚜 Total de Veículos: *${total}* (${proprios} próprios, ${terceiros} terceiros)\n`;
  text += `🟢 Operacionais: *${operacionais}* | 🔧 Em Oficina: *${emManutencao}*\n\n`;
  text += `*VEÍCULOS CADASTRADOS:*\n`;

  machineries.forEach((v, idx) => {
    const idStr = v.licensePlateOrSerial || v.serialNumber || 'S/ Placa';
    const comp = v.compositionType === 'cavalo' ? ' [Cavalo]' : v.compositionType === 'reboque' ? ' [Reboque]' : '';
    const engatado = v.coupledTrailerName ? ` -> Engatado: ${v.coupledTrailerName}` : '';
    const meters = [v.hourMeter ? `${v.hourMeter}h` : '', v.currentKm ? `${v.currentKm}km` : ''].filter(Boolean).join(' | ');
    const owner = v.ownerName ? ` (Titular: ${v.ownerName})` : '';

    text += `${idx + 1}. *${idStr}* - ${v.brand || ''} ${v.model || v.name}${comp}${engatado}${owner}`;
    if (meters) text += ` - Leitura: ${meters}`;
    text += ` [${v.status.toUpperCase()}]\n`;
  });

  text += `\n_Emitido via Módulo de Frotas & Veículos_`;
  return text;
}

/**
 * Scans all recent fuel logs, maintenance logs, and service records to find the
 * highest recorded hour meter and odometer per vehicle, returning updated machineries.
 */
export function syncFleetMeters(
  machineries: Machinery[],
  fuelLogs: FuelLog[] = [],
  maintenanceLogs: MaintenanceLog[] = [],
  services: ServiceOrder[] = [],
  orders: SilageOrder[] = []
): { updatedMachineries: Machinery[]; updatedCount: number } {
  let updatedCount = 0;

  const updatedMachineries = machineries.map((vehicle) => {
    let maxHourMeter = vehicle.hourMeter || 0;
    let maxKm = vehicle.currentKm || 0;
    let changed = false;

    // 1. Check Fuel logs
    const vFuel = fuelLogs.filter(f => f.machineryId === vehicle.id);
    for (const f of vFuel) {
      if (f.currentHourMeter && f.currentHourMeter > maxHourMeter) {
        maxHourMeter = f.currentHourMeter;
        changed = true;
      }
      if (f.currentKm && f.currentKm > maxKm) {
        maxKm = f.currentKm;
        changed = true;
      }
      if (f.currentHourMeterOrKm) {
        if (f.currentHourMeterOrKm > 5000 && f.currentHourMeterOrKm > maxKm) {
          maxKm = f.currentHourMeterOrKm;
          changed = true;
        } else if (f.currentHourMeterOrKm <= 5000 && f.currentHourMeterOrKm > maxHourMeter) {
          maxHourMeter = f.currentHourMeterOrKm;
          changed = true;
        }
      }
    }

    // 2. Check Maintenance logs
    const vMaint = maintenanceLogs.filter(m => m.machineryId === vehicle.id);
    for (const m of vMaint) {
      if (m.currentHourMeterOrKm) {
        if (m.currentHourMeterOrKm > 5000 && m.currentHourMeterOrKm > maxKm) {
          maxKm = m.currentHourMeterOrKm;
          changed = true;
        } else if (m.currentHourMeterOrKm <= 5000 && m.currentHourMeterOrKm > maxHourMeter) {
          maxHourMeter = m.currentHourMeterOrKm;
          changed = true;
        }
      }
    }

    if (changed) {
      updatedCount++;
      return {
        ...vehicle,
        hourMeter: maxHourMeter > 0 ? maxHourMeter : vehicle.hourMeter,
        currentKm: maxKm > 0 ? maxKm : vehicle.currentKm,
      };
    }

    return vehicle;
  });

  return { updatedMachineries, updatedCount };
}
