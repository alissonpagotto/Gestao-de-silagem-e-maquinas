import React, { useState, useEffect } from 'react';
import { FuelLog, Machinery, Employee } from '../../types';
import { FleetFuelView } from './FleetFuelView';
import { supabase } from '../../lib/supabaseClient';
import { fetchAbastecimentos } from '../../lib/supabaseService';
import { getStoredFuelLogs } from '../../lib/storage';

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
 * Sincronizado em tempo real com o Supabase Realtime (tabela 'abastecimentos')
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
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => propFuelLogs || getStoredFuelLogs());

  useEffect(() => {
    if (propFuelLogs) {
      setFuelLogs(propFuelLogs);
    }
  }, [propFuelLogs]);

  // 1. ATIVAÇÃO DO ESCUTADOR DE EVENTOS REALTIME (Postgres Changes na tabela abastecimentos):
  useEffect(() => {
    let isMounted = true;

    const fetchUpdatedData = async () => {
      try {
        const fresh = await fetchAbastecimentos();
        if (fresh && fresh.length > 0 && isMounted) {
          setFuelLogs(fresh);
          if (onSaveFuelLogs) {
            onSaveFuelLogs(fresh);
          }
        }
      } catch (err) {
        console.warn('FuelModule: Erro ao buscar abastecimentos atualizados:', err);
      }
    };

    // Subscrição ao canal Realtime do Supabase na tabela 'abastecimentos'
    const canalAbastecimentos = supabase
      .channel('mudancas-abastecimentos-module')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'abastecimentos' },
        (_payload) => {
          // Re-busca imediata com renderização instantânea da tabela e dos cards na hora
          fetchUpdatedData(); 
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        (_payload) => {
          fetchUpdatedData();
        }
      )
      .subscribe();

    // 3. EVITAR CONFLITOS COM O PROXY DO GOOGLE IDX (Fallback Seguro a cada 30 segundos)
    const intervalId = setInterval(() => {
      fetchUpdatedData();
    }, 30000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchUpdatedData();
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      supabase.removeChannel(canalAbastecimentos);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [onSaveFuelLogs]);

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
