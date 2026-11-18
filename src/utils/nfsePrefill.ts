import { InventoryItem, ServiceOrder } from '../types';
import { formatDateBR } from '../lib/storage';

export const PENDING_NFSE_PREFILL_STORAGE_KEY = 'agrocontrol_pending_nfse_prefill';
export const OPEN_NFSE_FROM_SERVICE_EVENT = 'agrocontrol_open_nfse_from_service';

export interface PendingNfseFromServicePayload {
  serviceId: string;
  orderNumber: string;
  clientId?: string;
  clientName: string;
  totalAmount: number;
  condicaoPagamento: string;
  dueDate: string;
  quantity: number;
  unit: string;
  unitRate: number;
  description: string;
  serviceType: string;
}

export const BUILTIN_NFSE_UNITS = ['HORAS', 'HA', 'ALQ', 'TON', 'UN', 'KM'] as const;

export function normalizeNfseUnit(rawUnit?: string): string {
  const u = String(rawUnit || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (!u) return 'UN';
  if (u === 'H' || u === 'HR' || u === 'HRS' || u === 'HORA' || u === 'HORAS') return 'HORAS';
  if (u === 'HA' || u === 'HECTARE' || u === 'HECTARES') return 'HA';
  if (u === 'ALQ' || u === 'ALQUEIRE' || u === 'ALQUEIRES') return 'ALQ';
  if (u === 'T' || u === 'TON' || u === 'TONELADA' || u === 'TONELADAS') return 'TON';
  if (u === 'KM' || u === 'QUILOMETRO' || u === 'QUILOMETROS') return 'KM';
  if (u === 'UN' || u === 'UND' || u === 'UNID' || u === 'UNIDADE' || u === 'SERV' || u === 'SERVICO' || u === 'SERVICOS') {
    return 'UN';
  }
  return u;
}

export function isInventoryItemService(item: InventoryItem): boolean {
  const tipoItem = String(item.tipo_item || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (tipoItem === 'SERVICO' || tipoItem.includes('SERVICO') || tipoItem.includes('MAO DE OBRA')) {
    return true;
  }

  const catText = String([
    item.categoria,
    item.category,
    item.tipo_produto,
    item.grupo,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? '').toLowerCase();

  return (
    catText.includes('servi') ||
    catText.includes('mao de obra') ||
    catText.includes('operacao') ||
    catText.includes('operacoes')
  );
}

export function getInventoryItemServicePrice(item: InventoryItem): number {
  const anyItem = item as any;
  const candidates = [
    anyItem.finalPrice,
    anyItem.precoVenda,
    item.salePrice,
    item.preco_venda_varejo,
    item.preco_venda,
    item.wholesalePrice,
    item.preco_venda_atacado,
    item.unitCost,
    item.preco_custo_inicial,
    item.custo_nominal,
  ];
  for (const val of candidates) {
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) return Number(num.toFixed(2));
  }
  return 0;
}

export function extractLc116CodeFromInventoryItem(item: InventoryItem): string {
  const anyItem = item as any;
  const directCandidates = [
    anyItem.lc116Code,
    anyItem.codigoServico,
    anyItem.codigo_servico,
    anyItem.codServico,
    anyItem.cod_servico,
  ];
  for (const cand of directCandidates) {
    const str = String(cand || '').trim();
    if (str) return str;
  }

  // Fallback: se o NCM/código contiver padrão LC 116 (ex: "17.05" ou "07.10")
  const ncmOrCode = [item.ncm, item.codigo_ncm, item.code, item.codigo_produto]
    .filter(Boolean)
    .map((s) => String(s).trim());
  for (const val of ncmOrCode) {
    const match = val.match(/\b(\d{1,2}\.\d{2})\b/);
    if (match) return match[1];
  }

  return '';
}

export function mapServicePaymentMethodToNfseCondicao(paymentMethod?: string): string {
  const m = String(paymentMethod || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!m) return 'Boleto Bancário';
  if (m.includes('pix')) return 'PIX';
  if (m.includes('dinheiro') || m.includes('especie')) return 'Dinheiro';
  if (m.includes('cartao') || m.includes('credito') || m.includes('debito')) return 'Cartão Crédito/Débito';
  if (m.includes('transfer') || m.includes('ted') || m.includes('doc')) return 'Transferência';
  if (m.includes('cheque')) return 'Cheque';
  if (m.includes('boleto')) return 'Boleto Bancário';
  if (m.includes('prazo') || m.includes('faturado') || m.includes('safra') || m.includes('parcel')) {
    return 'A Prazo / Faturado';
  }
  return 'Boleto Bancário';
}

export function resolveServiceMetricsForNfse(
  os: ServiceOrder,
  overrideTotalAmount?: number
): {
  quantity: number;
  unit: string;
  unitRate: number;
  quantityDisplayText: string;
} {
  const total = Number(overrideTotalAmount ?? os.totalAmount ?? 0);
  const typeStr = String(os.serviceType ?? '').toLowerCase();
  const tabStr = String(os.serviceTab ?? '').toLowerCase();
  const isFreight =
    tabStr === 'frete' ||
    typeStr.includes('frete') ||
    typeStr.includes('transporte') ||
    os.equipmentCategory === 'caminhoes' ||
    Boolean(os.truckBillingMode);

  let qty = 0;
  let unit = 'HORAS';
  let rate = 0;
  let qtyText = '';

  if (isFreight) {
    const mode = os.truckBillingMode;
    if ((mode === 'km' || mode === 'somente_km') && Number(os.truckServiceTotalKm) > 0) {
      qty = Number(os.truckServiceTotalKm);
      unit = 'KM';
      rate = Number(os.truckServiceRateOnlyKm || 0);
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} KM`;
    } else if (mode === 'horas' && Number(os.truckServiceHours) > 0) {
      qty = Number(os.truckServiceHours);
      unit = 'HORAS';
      rate = Number(os.truckServiceHourlyRate || 0);
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} H`;
    } else if ((mode === 'cargas' || mode === 'cargas_km') && Number(os.truckServiceLoads) > 0) {
      qty = Number(os.truckServiceLoads);
      unit = 'UN';
      rate = Number(os.truckServiceRatePerLoad || 0);
      const addKm = Number(os.truckServiceKmAdditional) > 0 ? ` + ${os.truckServiceKmAdditional} KM` : '';
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} CARGAS${addKm}`;
    } else if (mode === 'viagem' && Number(os.truckServiceTrips) > 0) {
      qty = Number(os.truckServiceTrips);
      unit = 'UN';
      rate = Number(os.truckServiceRatePerTrip || 0);
      qtyText = `${qty} VIAGEM${qty > 1 ? 'S' : ''}`;
    } else if (Number(os.truckServiceTotalKm) > 0) {
      qty = Number(os.truckServiceTotalKm);
      unit = 'KM';
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} KM`;
    } else if (Number(os.truckServiceHours) > 0) {
      qty = Number(os.truckServiceHours);
      unit = 'HORAS';
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} H`;
    }
  } else if (tabStr === 'maquina' && Number(os.machineHours) > 0) {
    qty = Number(os.machineHours);
    unit = 'HORAS';
    rate = Number(os.machineHourlyRate || 0);
    qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} H`;
  }

  if (qty <= 0) {
    const areaQty = Number(os.areaQuantity ?? os.areaHectares ?? 0);
    const hrs = Number(os.hoursWorked ?? os.tractorHours ?? os.forageDrumHours ?? os.forageEngineHours ?? 0);
    const tons = Number(os.tonsHarvested ?? os.tonsEstimated ?? 0);

    if (areaQty > 0) {
      qty = areaQty;
      unit =
        os.areaUnit === 'alqueires'
          ? 'ALQ'
          : os.areaUnit === 'hora'
            ? 'HORAS'
            : os.areaUnit === 'sacas'
              ? 'UN'
              : 'HA';
      rate = Number(os.ratePerAreaUnit ?? os.ratePerUnit ?? 0);
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unit}`;
    } else if (hrs > 0) {
      qty = hrs;
      unit = 'HORAS';
      rate = Number(os.tractorRatePerHour ?? os.forageRatePerHour ?? os.ratePerUnit ?? 0);
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} HORAS`;
    } else if (tons > 0) {
      qty = tons;
      unit = 'TON';
      rate = Number(os.ratePerUnit ?? 0);
      qtyText = `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} TON`;
    } else {
      qty = 1;
      unit = normalizeNfseUnit(os.areaUnit || 'UN');
      rate = total;
      qtyText = `1 ${unit}`;
    }
  }

  // Garante coerência com o valor total faturado (ex: após desconto/acréscimo na auditoria)
  if (qty > 0 && total > 0) {
    const computedFromRate = Number((qty * rate).toFixed(2));
    if (rate <= 0 || Math.abs(computedFromRate - total) > 0.05) {
      rate = Number((total / qty).toFixed(2));
    }
  }

  return {
    quantity: qty,
    unit,
    unitRate: rate,
    quantityDisplayText: qtyText,
  };
}

export function buildServiceDescriptionForNfse(
  os: ServiceOrder,
  options?: {
    overrideTotalAmount?: number;
    billingNotes?: string;
    orderNumber?: string;
  }
): string {
  const cleanOrderNum = (options?.orderNumber || os.orderNumber || '').trim();
  const orderTag = cleanOrderNum
    ? ` (OS Nº ${cleanOrderNum.startsWith('#') ? cleanOrderNum : `#${cleanOrderNum}`})`
    : '';
  const serviceTitle = (os.serviceType || 'SERVIÇO AGRÍCOLA').trim().toUpperCase();
  const dateIso = os.startDate || os.date || os.completionDate;
  const dateFormatted = dateIso ? formatDateBR(dateIso) : '';
  const metrics = resolveServiceMetricsForNfse(os, options?.overrideTotalAmount);

  const lines: string[] = [];
  lines.push(`PRESTAÇÃO DE SERVIÇO: ${serviceTitle}${orderTag}`);

  const metaParts: string[] = [];
  if (dateFormatted && dateFormatted !== '--') {
    metaParts.push(`DATA: ${dateFormatted}`);
  }
  if (os.farmName) {
    metaParts.push(`LOCAL/FAZENDA: ${os.farmName.trim().toUpperCase()}`);
  }
  if (metrics.quantityDisplayText) {
    metaParts.push(`QUANTIDADE/MEDIÇÃO: ${metrics.quantityDisplayText}`);
  }
  if (metaParts.length > 0) {
    lines.push(metaParts.join(' | '));
  }

  const equipParts: string[] = [];
  if (os.forageHarvesterName) equipParts.push(`FORRAGEIRA: ${os.forageHarvesterName.trim().toUpperCase()}`);
  if (os.tractorName) equipParts.push(`TRATOR: ${os.tractorName.trim().toUpperCase()}`);
  if (os.machineryAssigned && !os.forageHarvesterName && !os.tractorName) {
    equipParts.push(`EQUIPAMENTO/VEÍCULO: ${os.machineryAssigned.trim().toUpperCase()}`);
  } else if (os.machineSpecificType) {
    equipParts.push(`MÁQUINA: ${os.machineSpecificType.trim().toUpperCase()}`);
  }
  if (os.trucks && os.trucks.length > 0) {
    const truckNames = os.trucks
      .map((t) => t.truckName)
      .filter(Boolean)
      .join(', ');
    if (truckNames) {
      equipParts.push(`FROTAS/CAMINHÕES: ${truckNames.toUpperCase()}`);
    }
  }
  if (os.freightOrigin || os.freightDestination) {
    equipParts.push(
      `ROTA: ${(os.freightOrigin || 'ORIGEM').trim().toUpperCase()} ➔ ${(os.freightDestination || 'DESTINO').trim().toUpperCase()}`
    );
  }
  if (os.freightMaterialType) {
    equipParts.push(`MATERIAL/CARGA: ${os.freightMaterialType.trim().toUpperCase()}`);
  }
  if (equipParts.length > 0) {
    lines.push(equipParts.join(' | '));
  }

  const osNotes = (os.notes || '').trim().toUpperCase();
  if (osNotes) {
    lines.push(`OBSERVAÇÕES: ${osNotes}`);
  }

  const rawBillingNotes = (options?.billingNotes ?? os.billingNotes ?? '')
    .replace(/\[FATURAMENTO:.*?\]/gi, '')
    .trim()
    .toUpperCase();
  if (rawBillingNotes && rawBillingNotes !== osNotes) {
    lines.push(`OBS. FATURAMENTO: ${rawBillingNotes}`);
  }

  return lines.join('\n');
}

export function buildPendingNfsePayloadFromBilling(
  originalService: ServiceOrder,
  splitOrders: ServiceOrder[]
): PendingNfseFromServicePayload {
  const firstOrder = splitOrders[0] || originalService;
  const totalAmount = Number(
    splitOrders
      .reduce((acc, item) => acc + (Number(item.totalAmount) || 0), 0)
      .toFixed(2)
  ) || Number(originalService.totalAmount || 0);

  const rawOrderNum = firstOrder.orderNumber || originalService.orderNumber || '';
  const cleanOrderNum = rawOrderNum
    ? rawOrderNum.replace(/(-P\d+.*|-P\d+\/\d+|-(\d+)\/\d+|-\d+.*)$/i, '').trim()
    : '';

  const condicaoPagamento = mapServicePaymentMethodToNfseCondicao(
    firstOrder.paymentMethod || originalService.paymentMethod
  );

  // Menor vencimento entre as parcelas geradas (ou vencimento padrão)
  const validDueDates = splitOrders
    .map((o) => o.dueDate)
    .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}/.test(d)))
    .sort();
  const dueDate =
    validDueDates[0] ||
    firstOrder.dueDate ||
    originalService.dueDate ||
    new Date().toISOString().split('T')[0];

  const metrics = resolveServiceMetricsForNfse(originalService, totalAmount);
  const description = buildServiceDescriptionForNfse(originalService, {
    overrideTotalAmount: totalAmount,
    billingNotes: firstOrder.billingNotes || originalService.billingNotes,
    orderNumber: cleanOrderNum,
  });

  return {
    serviceId: firstOrder.id || originalService.id,
    orderNumber: cleanOrderNum || `#${originalService.id.slice(-4)}`,
    clientId: originalService.clientId || firstOrder.clientId,
    clientName: (originalService.clientName || firstOrder.clientName || '').trim(),
    totalAmount,
    condicaoPagamento,
    dueDate,
    quantity: metrics.quantity,
    unit: metrics.unit,
    unitRate: metrics.unitRate,
    description,
    serviceType: originalService.serviceType || 'Prestação de Serviço',
  };
}
