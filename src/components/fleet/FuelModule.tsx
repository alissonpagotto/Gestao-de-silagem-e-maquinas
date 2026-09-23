import React from 'react';
import { FuelLog, Machinery, Employee } from '../../types';
import { FleetFuelView } from './FleetFuelView';
import { useAbastecimentosRealtime } from '../../hooks/useAbastecimentosRealtime';

export interface FuelModuleProps {
  fuelLogs?: FuelLog[];
  machineries?: Machinery[];
  employees?: Employee[];
  onOpenNewFuel?: () => void;
  onEditFuel?: (log: FuelLog) => void;
  onDeleteFuel?: (id: string) => void;
  onSaveFuelLogs?: (logs: FuelLog[]) => void;
}

/**
 * FuelModule (Módulo dedicado de Gestão de Abastecimentos)
 * Sincronizado em tempo real com o Supabase Realtime via useAbastecimentosRealtime
 * com fallback seguro para ambientes de proxy e sandbox do Google IDX.
 */
export const FuelModule: React.FC<FuelModuleProps> = ({
  fuelLogs: propFuelLogs,
  machineries = [],
  employees = [],
  onOpenNewFuel = () => {},
  onEditFuel = () => {},
  onDeleteFuel = () => {},
  onSaveFuelLogs,
}) => {
  // Sincronização em tempo real via Hook unificado (Realtime + Polling 30s + Foco da Janela)
  const { fuelLogs } = useAbastecimentosRealtime({
    initialLogs: propFuelLogs,
    onUpdate: onSaveFuelLogs,
  });

  return (
    <FleetFuelView
      fuelLogs={fuelLogs}
      machineries={machineries}
      employees={employees}
      onOpenNewFuel={onOpenNewFuel}
      onEditFuel={onEditFuel}
      onDeleteFuel={onDeleteFuel}
    />
  );
};

export default FuelModule;
