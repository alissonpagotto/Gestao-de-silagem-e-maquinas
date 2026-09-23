import { Machinery, CompanyProfile, FuelLog, MaintenanceLog, Expense, ServiceOrder, SilageOrder, Employee } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

/**
 * Generates the clean, executive A4 HTML report for the vehicle's registration data:
 * - Identificação Básica (Placa, Frota, Modelo, Marca, Ano, Renavam, Categoria, Composição, Status)
 * - Dados de Propriedade & Titularidade (Regime, Proprietário Principal, CPF/CNPJ, Coproprietário)
 * - Controle de Pesos & Medidores (Tara, Lotação, PBT Calculado, M³, Horímetro, Odômetro/KM)
 * - Dados Comerciais & Financeiros (Aquisição, Fornecedor, NF, Financiamento)
 * - Motoristas / Operadores Vinculados & Médias Automáticas
 */
export function generateVehicleRegistrationPrintHtml(
  vehicle: Machinery,
  company: CompanyProfile,
  assignedDriverNames: string[] = []
): string {
  const pbt = (vehicle.taraWeightKg || 0) + (vehicle.capacityLoadKg || 0);

  const driversText = assignedDriverNames.length > 0 
    ? assignedDriverNames.join(', ')
    : (vehicle.operatorOrDriver || 'Nenhum motorista/operador vinculado');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.4;">
      
      <!-- IDENTIFICAÇÃO DO VEÍCULO -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0963cb; text-transform: uppercase; letter-spacing: 0.5px;">
            1. Identificação Básica do Veículo / Equipamento
          </h3>
          <span style="background: #0963cb; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
            ${vehicle.status ? vehicle.status.toUpperCase() : 'DISPONÍVEL'}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px;">
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Placa / Identificação</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a; font-family: monospace;">${vehicle.licensePlateOrSerial || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Nº da Frota</div>
            <div style="font-size: 14px; font-weight: 900; color: #0963cb; font-family: monospace;">${vehicle.fleetNumber || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Marca</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${(vehicle.brand || '--').toUpperCase()}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Modelo / Descrição</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${(vehicle.model || vehicle.name || '--').toUpperCase()}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Ano Fabricação / Mod.</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${vehicle.year || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Renavam</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${vehicle.renavam || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Nº de Chassi / Série</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${vehicle.serialNumber || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cor</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${vehicle.color || '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Capacidade Tanque</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${(vehicle.tank_capacity || vehicle.tankCapacity || vehicle.fuelCapacityLiters) ? `${(vehicle.tank_capacity || vehicle.tankCapacity || vehicle.fuelCapacityLiters)?.toLocaleString('pt-BR')} L` : '--'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Categoria Operacional</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${vehicle.categoryType || 'Equipamento Agrícola'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tipo de Composição</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${vehicle.compositionType === 'cavalo' ? 'Cavalo Mecânico' : vehicle.compositionType === 'reboque' ? 'Reboque / Carreta' : 'Veículo Simples'}</div>
          </div>
          <div style="grid-column: span 2;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Implemento / Reboque Vinculado</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">
              ${vehicle.hasCoupledTrailer || vehicle.trailerPlate || vehicle.coupledTrailerName
                ? `${vehicle.trailerPlate ? `Placa: ${vehicle.trailerPlate}` : ''} ${vehicle.trailerModel ? `• Modelo: ${vehicle.trailerModel}` : (vehicle.coupledTrailerName ? `• ${vehicle.coupledTrailerName}` : '')} ${vehicle.coupledTrailerType ? `(${vehicle.coupledTrailerType})` : ''} ${vehicle.trailerCapacityLoadKg ? `• Capacidade: ${vehicle.trailerCapacityLoadKg} kg${vehicle.trailerCapacityM3 ? ` / ${vehicle.trailerCapacityM3} m³` : ''}` : ''}`.trim()
                : 'Nenhum acoplado'}
            </div>
          </div>
        </div>
      </div>

      <!-- DADOS DE PROPRIEDADE E TITULARIDADE -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0963cb; text-transform: uppercase; letter-spacing: 0.5px;">
            2. Propriedade, Titularidade e Registro em Documento
          </h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px;">
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Regime de Propriedade</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${vehicle.ownership || 'Próprio'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Titular no Documento (CRLV)</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${vehicle.ownerName || 'Não especificado'}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">CPF / CNPJ do Titular</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; font-family: monospace;">${vehicle.ownerDocument || '--'}</div>
          </div>
          ${vehicle.secondaryOwnerName ? `
            <div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Coproprietário / 2º Sócio</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${vehicle.secondaryOwnerName}</div>
            </div>
            <div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Documento do 2º Titular</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${vehicle.secondaryOwnerDocument || '--'}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- CONTROLE DE PESOS, CAPACIDADES E MEDIDORES -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0963cb; text-transform: uppercase; letter-spacing: 0.5px;">
            3. Controle de Pesos, Capacidade de Carga & Medidores Atuais
          </h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; font-size: 11px;">
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tara (Vazio)</div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; font-family: monospace;">${vehicle.taraWeightKg ? `${vehicle.taraWeightKg.toLocaleString('pt-BR')} kg` : '--'}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Lotação Útil</div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; font-family: monospace;">${vehicle.capacityLoadKg ? `${vehicle.capacityLoadKg.toLocaleString('pt-BR')} kg` : '--'}</div>
          </div>
          <div style="background: #eff6ff; padding: 8px; border-radius: 6px; border: 1.5px solid #93c5fd; text-align: center;">
            <div style="font-size: 9px; font-weight: 800; color: #1e40af; text-transform: uppercase;">PBT Calculado</div>
            <div style="font-size: 13px; font-weight: 900; color: #0963cb; font-family: monospace;">${pbt > 0 ? `${pbt.toLocaleString('pt-BR')} kg` : '--'}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Caçamba / M³</div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; font-family: monospace;">${vehicle.capacityM3 ? `${vehicle.capacityM3.toLocaleString('pt-BR')} m³` : '--'}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Horímetro Atual</div>
            <div style="font-size: 13px; font-weight: 900; color: #d97706; font-family: monospace;">${vehicle.hourMeter ? `${vehicle.hourMeter.toLocaleString('pt-BR')} h` : '--'}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Odômetro Atual</div>
            <div style="font-size: 13px; font-weight: 900; color: #059669; font-family: monospace;">${vehicle.currentKm ? `${vehicle.currentKm.toLocaleString('pt-BR')} km` : '--'}</div>
          </div>
        </div>
      </div>

      <!-- DADOS DE AQUISIÇÃO E OPERADORES -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        
        <!-- Aquisição e Nota Fiscal -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px;">
          <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
              4. Dados de Aquisição & Financeiro
            </h3>
          </div>
          <div style="font-size: 11px; space-y: 6px;">
            <div style="margin-bottom: 4px;"><strong>Valor de Compra:</strong> ${vehicle.purchaseValue ? formatCurrencyBRL(vehicle.purchaseValue) : 'Não informado'}</div>
            <div style="margin-bottom: 4px;"><strong>Data da Compra:</strong> ${formatDateBR(vehicle.purchaseDate)}</div>
            <div style="margin-bottom: 4px;"><strong>Fornecedor / Origem:</strong> ${vehicle.purchaseSupplier || '--'}</div>
            <div style="margin-bottom: 4px;"><strong>Nota Fiscal:</strong> ${vehicle.purchaseInvoiceNumber || '--'}</div>
            <div><strong>Financiado:</strong> ${vehicle.isFinancedOrInstallments ? `Sim (${vehicle.installmentsCount || '--'} parcelas de ${vehicle.installmentValue ? formatCurrencyBRL(vehicle.installmentValue) : '--'})` : 'Não (À Vista / Próprio)'}</div>
          </div>
        </div>

        <!-- Controle Patrimonial, Impostos & Licenciamento -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px;">
          <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
              5. Controle Patrimonial & Impostos
            </h3>
          </div>
          <div style="font-size: 11px;">
            <div style="margin-bottom: 4px;"><strong>Valor Comercial FIPE:</strong> ${vehicle.fipeValue ? formatCurrencyBRL(vehicle.fipeValue) : 'Não informado'}</div>
            <div style="margin-bottom: 4px;"><strong>Valor Base IPVA (Venal):</strong> ${vehicle.ipvaBaseValue ? formatCurrencyBRL(vehicle.ipvaBaseValue) : 'Não informado'}</div>
            <div style="margin-bottom: 4px;"><strong>Alíquota IPVA:</strong> ${vehicle.ipvaRatePercent ? `${vehicle.ipvaRatePercent}%` : '--'}</div>
            <div style="margin-bottom: 4px;"><strong>Total IPVA:</strong> <span style="font-weight: 800; color: #0963cb;">${vehicle.ipvaTotalAmount ? formatCurrencyBRL(vehicle.ipvaTotalAmount) : (vehicle.ipvaBaseValue && vehicle.ipvaRatePercent ? formatCurrencyBRL(vehicle.ipvaBaseValue * (vehicle.ipvaRatePercent / 100)) : 'R$ 0,00')}</span> ${vehicle.ipvaInstallmentsCount ? `(${vehicle.ipvaInstallmentsCount}x)` : ''}</div>
            <div style="margin-bottom: 4px;"><strong>Licenciamento Anual:</strong> ${vehicle.licensingValue ? formatCurrencyBRL(vehicle.licensingValue) : 'Não informado'}</div>
            <div><strong>Status Financeiro:</strong> IPVA (${vehicle.ipvaFinancialStatus === 'lancado' ? 'Lançado no Contas a Pagar' : 'Pendente'}) | Licenc. (${vehicle.licensingFinancialStatus === 'lancado' ? 'Lançado' : 'Pendente'})</div>
          </div>
        </div>

      </div>

      <!-- OPERADORES E MÉDIAS DE CONSUMO -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 6px; margin-bottom: 10px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
            6. Operadores & Médias Registradas
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 11px;">
          <div>
            <div style="margin-bottom: 6px;"><strong>Motoristas / Operadores Vinculados:</strong><br><span style="color: #0f172a; font-weight: 600;">${driversText}</span></div>
            <div><strong>Capacidade do Tanque:</strong> ${vehicle.fuelCapacityLiters ? `${vehicle.fuelCapacityLiters} L` : '--'}</div>
          </div>
          <div>
            <div style="margin-bottom: 4px;"><strong>Média Histórica por Km:</strong> ${vehicle.averageConsumptionKmPerLiter ? `${vehicle.averageConsumptionKmPerLiter.toLocaleString('pt-BR')} km/L` : 'Aguardando registros'}</div>
            <div style="margin-bottom: 4px;"><strong>Média Histórica por Hora:</strong> ${vehicle.averageConsumptionLitersPerHour ? `${vehicle.averageConsumptionLitersPerHour.toLocaleString('pt-BR')} L/h` : 'Aguardando registros'}</div>
          </div>
        </div>
      </div>

      <!-- OBSERVAÇÕES ADICIONAIS -->
      ${vehicle.notes ? `
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
          <div style="font-size: 10px; font-weight: 800; color: #0963cb; text-transform: uppercase; margin-bottom: 4px;">Observações Cadastrais</div>
          <div style="font-size: 11px; color: #334155;">${vehicle.notes}</div>
        </div>
      ` : ''}

    </div>
  `;
}

/**
 * Generates the clean, executive A4 HTML report for the vehicle's historical performance:
 * - Médias de consumo & totais de combustível (L, R$)
 * - Histórico de abastecimentos recentes
 * - Histórico de ordens de serviço / manutenções mecânicas
 * - DRE Consolidado (Receitas brutas de fretes/serviços x Custos operacionais = Lucro Líquido)
 */
export function generateVehicleHistoryPrintHtml(
  vehicle: Machinery,
  company: CompanyProfile,
  fuelLogs: FuelLog[],
  maintenanceLogs: MaintenanceLog[],
  expenses: Expense[] = [],
  services: ServiceOrder[] = [],
  orders: SilageOrder[] = [],
  employees: Employee[] = []
): string {
  // Filter vehicle data
  const vehicleFuel = fuelLogs
    .filter(f => f.machineryId === vehicle.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const vehicleMaintenance = maintenanceLogs
    .filter(m => m.machineryId === vehicle.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Metrics
  const totalLiters = vehicleFuel.reduce((sum, f) => sum + (f.liters || 0), 0);
  const totalFuelCost = vehicleFuel.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
  const totalMaintenanceCost = vehicleMaintenance.reduce((sum, m) => sum + (m.totalCost || 0), 0);

  // Revenue from services and silage deliveries
  const plateClean = (vehicle.licensePlateOrSerial || '').toLowerCase().trim();
  const modelClean = (vehicle.model || vehicle.name || '').toLowerCase().trim();

  const vehicleServices = services.filter(srv => {
    if (srv.machineryId === vehicle.id) return true;
    if (plateClean && srv.machineryAssigned?.toLowerCase().includes(plateClean)) return true;
    if (modelClean && srv.machineryAssigned?.toLowerCase().includes(modelClean)) return true;
    return false;
  });

  const vehicleSilageOrders = orders.filter(ord => {
    if (ord.machineryId === vehicle.id) return true;
    if (plateClean && ord.machineryPlateOrName?.toLowerCase().includes(plateClean)) return true;
    if (modelClean && ord.machineryPlateOrName?.toLowerCase().includes(modelClean)) return true;
    return false;
  });

  const totalServicesRevenue = vehicleServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalFreightRevenue = vehicleSilageOrders.reduce((sum, o) => {
    return sum + (o.freightCost || (o.freightType === 'CIF' ? o.totalAmount * 0.15 : o.totalAmount));
  }, 0);

  const totalGrossRevenue = totalServicesRevenue + totalFreightRevenue;
  const totalOperatingCosts = totalFuelCost + totalMaintenanceCost;
  const netProfit = totalGrossRevenue - totalOperatingCosts;
  const profitMargin = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;

  // Fuel rows
  const fuelRows = vehicleFuel.slice(0, 10).map((f) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${formatDateBR(f.date)}</td>
      <td style="padding: 6px 8px;">${f.fuelType ? f.fuelType.toUpperCase() : 'DIESEL'}</td>
      <td style="padding: 6px 8px; font-weight: 700; text-align: right;">${f.liters.toLocaleString('pt-BR')} L</td>
      <td style="padding: 6px 8px; text-align: right;">${f.pricePerLiter ? formatCurrencyBRL(f.pricePerLiter) : '--'}</td>
      <td style="padding: 6px 8px; font-weight: 800; text-align: right; color: #0f172a;">${formatCurrencyBRL(f.totalAmount || 0)}</td>
      <td style="padding: 6px 8px; text-align: center; font-family: monospace;">${f.currentHourMeter ? `${f.currentHourMeter} h` : f.currentKm ? `${f.currentKm} km` : (f.currentHourMeterOrKm ? `${f.currentHourMeterOrKm}` : '--')}</td>
      <td style="padding: 6px 8px;">${f.supplierStation || '--'}</td>
    </tr>
  `).join('');

  // Maintenance rows
  const maintenanceRows = vehicleMaintenance.slice(0, 10).map((m) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${formatDateBR(m.date)}</td>
      <td style="padding: 6px 8px; font-weight: 700; text-transform: uppercase;">${m.type}</td>
      <td style="padding: 6px 8px;">${m.description}</td>
      <td style="padding: 6px 8px;">${m.workshopOrMechanic || m.executorName || '--'}</td>
      <td style="padding: 6px 8px; font-weight: 800; text-align: right; color: #0f172a;">${formatCurrencyBRL(m.totalCost || 0)}</td>
      <td style="padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; text-transform: uppercase; background: ${m.status === 'concluida' ? '#dcfce7; color: #15803d;' : '#fef3c7; color: #b45309;'}">
          ${m.status || 'concluida'}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.4;">
      
      <!-- CARDS DE RESUMO / INDICADORES -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Combustível Total</div>
          <div style="font-size: 15px; font-weight: 900; color: #0963cb; font-family: monospace;">${totalLiters.toLocaleString('pt-BR')} L</div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">Custo: ${formatCurrencyBRL(totalFuelCost)}</div>
        </div>

        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Manutenções (OS)</div>
          <div style="font-size: 15px; font-weight: 900; color: #d97706; font-family: monospace;">${vehicleMaintenance.length} ordens</div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">Custo: ${formatCurrencyBRL(totalMaintenanceCost)}</div>
        </div>

        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Receita Bruta Gerada</div>
          <div style="font-size: 15px; font-weight: 900; color: #059669; font-family: monospace;">${formatCurrencyBRL(totalGrossRevenue)}</div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">Serviços + Fretes</div>
        </div>

        <div style="background: ${netProfit >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1.5px solid ${netProfit >= 0 ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; font-weight: 800; color: ${netProfit >= 0 ? '#166534' : '#991b1b'}; text-transform: uppercase;">Lucro Operacional Líquido</div>
          <div style="font-size: 15px; font-weight: 900; color: ${netProfit >= 0 ? '#15803d' : '#b91c1c'}; font-family: monospace;">${formatCurrencyBRL(netProfit)}</div>
          <div style="font-size: 10px; font-weight: 800; color: ${netProfit >= 0 ? '#166534' : '#991b1b'}; margin-top: 2px;">Margem: ${profitMargin.toFixed(1)}%</div>
        </div>
      </div>

      <!-- DEMONSTRATIVO DRE RESUMIDO -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;">
        <div style="border-bottom: 1.5px solid #0963cb; padding-bottom: 4px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
            Demonstrativo de Resultado Operacional (DRE do Veículo)
          </h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="border-bottom: 1px dashed #cbd5e1;">
            <td style="padding: 4px 0; font-weight: 700; color: #059669;">(+) Receitas de Serviços de Silagem / Locações</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 800; color: #059669; font-family: monospace;">${formatCurrencyBRL(totalServicesRevenue)}</td>
          </tr>
          <tr style="border-bottom: 1px dashed #cbd5e1;">
            <td style="padding: 4px 0; font-weight: 700; color: #059669;">(+) Receitas de Frete e Entregas</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 800; color: #059669; font-family: monospace;">${formatCurrencyBRL(totalFreightRevenue)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #cbd5e1; background: #eff6ff;">
            <td style="padding: 5px 4px; font-weight: 900; color: #1e3a8a;">(=) RECEITA OPERACIONAL BRUTA</td>
            <td style="padding: 5px 4px; text-align: right; font-weight: 900; color: #1e3a8a; font-family: monospace;">${formatCurrencyBRL(totalGrossRevenue)}</td>
          </tr>
          <tr style="border-bottom: 1px dashed #cbd5e1;">
            <td style="padding: 4px 0; font-weight: 700; color: #dc2626;">(-) Custos com Combustível e Abastecimentos</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 800; color: #dc2626; font-family: monospace;">${formatCurrencyBRL(totalFuelCost)}</td>
          </tr>
          <tr style="border-bottom: 1px dashed #cbd5e1;">
            <td style="padding: 4px 0; font-weight: 700; color: #dc2626;">(-) Custos com Manutenções Preventivas & Corretivas</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 800; color: #dc2626; font-family: monospace;">${formatCurrencyBRL(totalMaintenanceCost)}</td>
          </tr>
          <tr style="background: ${netProfit >= 0 ? '#f0fdf4' : '#fef2f2'};">
            <td style="padding: 6px 4px; font-weight: 900; color: ${netProfit >= 0 ? '#15803d' : '#b91c1c'}; font-size: 12px;">(=) RESULTADO OPERACIONAL LÍQUIDO</td>
            <td style="padding: 6px 4px; text-align: right; font-weight: 900; color: ${netProfit >= 0 ? '#15803d' : '#b91c1c'}; font-size: 13px; font-family: monospace;">${formatCurrencyBRL(netProfit)}</td>
          </tr>
        </table>
      </div>

      <!-- HISTÓRICO DE ABASTECIMENTOS RECENTES -->
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="background: #f8fafc; border-bottom: 1.5px solid #0963cb; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 11px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
            Últimos Abastecimentos Registrados (${vehicleFuel.length} total)
          </h3>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">Exibindo os mais recentes</span>
        </div>
        ${vehicleFuel.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">Data</th>
                <th style="padding: 6px 8px; text-align: left;">Tipo</th>
                <th style="padding: 6px 8px; text-align: right;">Litros</th>
                <th style="padding: 6px 8px; text-align: right;">Preço/L</th>
                <th style="padding: 6px 8px; text-align: right;">Total</th>
                <th style="padding: 6px 8px; text-align: center;">Horím./KM</th>
                <th style="padding: 6px 8px; text-align: left;">Posto/Origem</th>
              </tr>
            </thead>
            <tbody>
              ${fuelRows}
            </tbody>
          </table>
        ` : `
          <div style="padding: 16px; text-align: center; color: #64748b; font-size: 11px;">Nenhum registro de abastecimento encontrado para este veículo.</div>
        `}
      </div>

      <!-- HISTÓRICO DE MANUTENÇÕES RECENTES -->
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="background: #f8fafc; border-bottom: 1.5px solid #0963cb; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 11px; font-weight: 800; color: #0963cb; text-transform: uppercase;">
            Últimas Manutenções & Ordens de Serviço (${vehicleMaintenance.length} total)
          </h3>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">Exibindo as mais recentes</span>
        </div>
        ${vehicleMaintenance.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">Data</th>
                <th style="padding: 6px 8px; text-align: left;">Tipo</th>
                <th style="padding: 6px 8px; text-align: left;">Serviço Realizado / Descrição</th>
                <th style="padding: 6px 8px; text-align: left;">Oficina / Prestador</th>
                <th style="padding: 6px 8px; text-align: right;">Valor</th>
                <th style="padding: 6px 8px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${maintenanceRows}
            </tbody>
          </table>
        ` : `
          <div style="padding: 16px; text-align: center; color: #64748b; font-size: 11px;">Nenhum registro de manutenção ou ordem de serviço encontrado para este veículo.</div>
        `}
      </div>

    </div>
  `;
}
