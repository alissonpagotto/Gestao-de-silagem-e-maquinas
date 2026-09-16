import { VehicleTypeDefinition, VehicleAxleConfig, TireItem, RotationPatternType, TireMovement } from '../types';

// ========================================================
// CONFIGURAÇÕES PADRÃO DE EIXOS PARA FROTA AGRÍCOLA E PESADA
// ========================================================

export const AXLE_CONFIG_UTILITARIO_2E_4R: VehicleAxleConfig = {
  code: 'utilitario_2e_4r',
  name: '2 Eixos / 4 Rodas Simples (Utilitário / Carro / Picape)',
  totalAxles: 2,
  totalTires: 4,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Dianteiro Direcional)',
      type: 'single',
      function: 'direcional',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Traseiro Tração)',
      type: 'single',
      function: 'tracao',
      tirePositions: ['2E', '2D'],
    },
  ],
};

export const AXLE_CONFIG_CAMINHAO_TOCO_2E_6R: VehicleAxleConfig = {
  code: 'caminhao_toco_2e_6r',
  name: '2 Eixos / 6 Rodas (Caminhão Toco 4x2)',
  totalAxles: 2,
  totalTires: 6,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Dianteiro Simples)',
      type: 'single',
      function: 'direcional',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Traseiro Rodado Duplo)',
      type: 'dual',
      function: 'tracao',
      tirePositions: ['2EE', '2EI', '2DI', '2DD'],
    },
  ],
};

export const AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R: VehicleAxleConfig = {
  code: 'caminhao_trucado_3e_10r',
  name: '3 Eixos / 10 Rodas (Caminhão Trucado 6x2 / 6x4 Basculante)',
  totalAxles: 3,
  totalTires: 10,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Dianteiro Direcional)',
      type: 'single',
      function: 'direcional',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Tração Rodado Duplo)',
      type: 'dual',
      function: 'tracao',
      tirePositions: ['2EE', '2EI', '2DI', '2DD'],
    },
    {
      axleNumber: 3,
      name: '3º Eixo (Truck / Apoio Rodado Duplo)',
      type: 'dual',
      function: 'truck_livre',
      tirePositions: ['3EE', '3EI', '3DI', '3DD'],
    },
  ],
};

export const AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R: VehicleAxleConfig = {
  code: 'trator_agricola_2e_4r',
  name: '2 Eixos / 4 Rodas Agrícolas (Trator 4x4 Diant. Menor / Tras. Maior)',
  totalAxles: 2,
  totalTires: 4,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Dianteiro Agrícola Guia)',
      type: 'single',
      function: 'agricola_dianteiro',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Traseiro Agrícola Alta Flutuação/Garra)',
      type: 'single',
      function: 'agricola_traseiro',
      tirePositions: ['2E', '2D'],
    },
  ],
};

export const AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R: VehicleAxleConfig = {
  code: 'ensiladeira_autopropelida_2e_4r',
  name: '2 Eixos / 4 Rodas (Ensiladeira/Forrageira Autopropelida)',
  totalAxles: 2,
  totalTires: 4,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo Dianteiro (Tração Primária Larga)',
      type: 'single',
      function: 'agricola_traseiro', // Pneus principais de tração
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo Traseiro (Direcional de Manobra)',
      type: 'single',
      function: 'agricola_dianteiro',
      tirePositions: ['2E', '2D'],
    },
  ],
};

export const AXLE_CONFIG_TRANSBORDO_REBOQUE_2E_4R: VehicleAxleConfig = {
  code: 'transbordo_reboque_2e_4r',
  name: '2 Eixos / 4 Rodas (Transbordo / Reboque Tandem Silagem)',
  totalAxles: 2,
  totalTires: 4,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Tandem Dianteiro)',
      type: 'single',
      function: 'reboque',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Tandem Traseiro)',
      type: 'single',
      function: 'reboque',
      tirePositions: ['2E', '2D'],
    },
  ],
};

export const AXLE_CONFIG_BITRUCK_4E_12R: VehicleAxleConfig = {
  code: 'bitruck_4e_12r',
  name: '4 Eixos / 12 Rodas (Caminhão Bitruck 8x2 / 8x4)',
  totalAxles: 4,
  totalTires: 12,
  axles: [
    {
      axleNumber: 1,
      name: '1º Eixo (Dianteiro 1 Direcional)',
      type: 'single',
      function: 'direcional',
      tirePositions: ['1E', '1D'],
    },
    {
      axleNumber: 2,
      name: '2º Eixo (Dianteiro 2 Direcional Auxiliar)',
      type: 'single',
      function: 'direcional',
      tirePositions: ['2E', '2D'],
    },
    {
      axleNumber: 3,
      name: '3º Eixo (Tração Rodado Duplo)',
      type: 'dual',
      function: 'tracao',
      tirePositions: ['3EE', '3EI', '3DI', '3DD'],
    },
    {
      axleNumber: 4,
      name: '4º Eixo (Truck Rodado Duplo)',
      type: 'dual',
      function: 'truck_livre',
      tirePositions: ['4EE', '4EI', '4DI', '4DD'],
    },
  ],
};

// ========================================================
// PRESETS DE ESTOQUE, REFORMA E DESCARTE DE PNEUS
// ========================================================

export const INITIAL_TIRE_INVENTORY: TireItem[] = [
  {
    id: 'tire_inv_001',
    position: 'estoque',
    positionName: 'Estoque / Disponível',
    fireNumber: '#0442',
    brand: 'Michelin',
    model: 'X Multi Z',
    size: '295/80 R22.5',
    treadDepthMm: 12.0,
    originalTreadDepthMm: 18.0,
    pressurePsi: 110,
    status: 'estoque',
    retreadCount: 0,
    currentKm: 35000,
    notes: 'Pneu meia-vida em excelente estado para dianteira ou tração',
  },
  {
    id: 'tire_inv_002',
    position: 'estoque',
    positionName: 'Estoque / Disponível',
    fireNumber: '#0518',
    brand: 'Pirelli',
    model: 'FG01',
    size: '295/80 R22.5',
    treadDepthMm: 14.5,
    originalTreadDepthMm: 18.0,
    pressurePsi: 110,
    status: 'estoque',
    retreadCount: 0,
    currentKm: 18000,
    notes: 'Pneu semi-novo rodagem mista / lavoura',
  },
  {
    id: 'tire_inv_003',
    position: 'estoque',
    positionName: 'Estoque / Disponível',
    fireNumber: '#0620',
    brand: 'Goodyear',
    model: 'KMAX S',
    size: '295/80 R22.5',
    treadDepthMm: 9.0,
    originalTreadDepthMm: 18.0,
    pressurePsi: 110,
    status: 'estoque',
    retreadCount: 1,
    currentKm: 65000,
    notes: '1ª Recapagem realizada - Ótimo para eixos de apoio / truck',
  },
  {
    id: 'tire_inv_004',
    position: 'estoque',
    positionName: 'Estoque / Disponível',
    fireNumber: '#0735',
    brand: 'Bridgestone',
    model: 'M726',
    size: '295/80 R22.5',
    treadDepthMm: 11.5,
    originalTreadDepthMm: 18.0,
    pressurePsi: 110,
    status: 'estoque',
    retreadCount: 0,
    currentKm: 42000,
    notes: 'Pneu de tração em bom estado',
  },
  {
    id: 'tire_inv_005',
    position: 'estoque',
    positionName: 'Estoque / Disponível',
    fireNumber: '#0812',
    brand: 'Firestone',
    model: 'FS591',
    size: '295/80 R22.5',
    treadDepthMm: 13.0,
    originalTreadDepthMm: 18.0,
    pressurePsi: 110,
    status: 'estoque',
    retreadCount: 0,
    currentKm: 26000,
    notes: 'Pronto para rodagem',
  },
];

export const INITIAL_TIRES_IN_REFORM: TireItem[] = [
  {
    id: 'tire_ref_001',
    position: 'reforma',
    positionName: 'Em Reforma',
    fireNumber: '#0329',
    brand: 'Michelin',
    model: 'XDE2',
    size: '295/80 R22.5',
    treadDepthMm: 3.5,
    originalTreadDepthMm: 18.0,
    pressurePsi: 0,
    status: 'reforma',
    retreadCount: 1,
    reformWorkshop: 'Recapadora Bandeirantes',
    reformSentDate: '2026-08-28',
    reformCost: 850,
    notes: 'Enviado para 1ª recapagem / Banda Tipler',
  },
  {
    id: 'tire_ref_002',
    position: 'reforma',
    positionName: 'Em Reforma',
    fireNumber: '#0294',
    brand: 'Pirelli',
    model: 'TG88',
    size: '295/80 R22.5',
    treadDepthMm: 2.8,
    originalTreadDepthMm: 18.0,
    pressurePsi: 0,
    status: 'reforma',
    retreadCount: 2,
    reformWorkshop: 'Borracharia São Cristóvão',
    reformSentDate: '2026-08-30',
    reformCost: 780,
    notes: 'Enviado para 2ª recapagem',
  },
];

export const INITIAL_TIRES_DISCARDED: TireItem[] = [
  {
    id: 'tire_disc_001',
    position: 'descarte',
    positionName: 'Descartado / Baixa',
    fireNumber: '#0105',
    brand: 'Goodyear',
    model: 'G658',
    size: '295/80 R22.5',
    treadDepthMm: 1.4,
    originalTreadDepthMm: 18.0,
    pressurePsi: 0,
    status: 'descartado',
    retreadCount: 2,
    discardReason: 'Fim de vida útil / TWI atingido',
    discardDate: '2026-08-15',
    discardNotes: 'Carcaça atingiu limite de recapagens e TWI.',
  },
];

// ========================================================
// LISTA PADRÃO DE TIPOS DE VEÍCULOS (EDITÁVEL PELO USUÁRIO)
// ========================================================

export const INITIAL_VEHICLE_TYPES: VehicleTypeDefinition[] = [
  {
    id: 'vt_forrageira',
    name: 'Forrageira / Ensiladeira',
    categoryKey: 'forrageira',
    defaultAxleConfig: AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R,
    description: 'Ensiladeiras de corte e processamento com pneus de alta tração',
  },
  {
    id: 'vt_ensiladeira_auto',
    name: 'Ensiladeira Autopropelida',
    categoryKey: 'ensiladeira',
    defaultAxleConfig: AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R,
    description: 'Máquinas de alta performance (Claas Jaguar, John Deere 8000/9000)',
  },
  {
    id: 'vt_caminhao_trucado',
    name: 'Caminhão (Basculante / Silagem)',
    categoryKey: 'caminhao',
    defaultAxleConfig: AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R,
    description: 'Caminhões 6x2 / 6x4 trucados com caçamba de silagem (10 rodas)',
  },
  {
    id: 'vt_caminhao_toco',
    name: 'Caminhão Toco (2 Eixos / 6 Rodas)',
    categoryKey: 'caminhao',
    defaultAxleConfig: AXLE_CONFIG_CAMINHAO_TOCO_2E_6R,
    description: 'Caminhões 4x2 com rodado duplo traseiro (6 rodas)',
  },
  {
    id: 'vt_trator_agricola',
    name: 'Trator Agrícola',
    categoryKey: 'trator',
    defaultAxleConfig: AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R,
    description: 'Tratores de tração e compactação com pneus agrícolas',
  },
  {
    id: 'vt_transbordo',
    name: 'Transbordo / Reboque Forrageiro',
    categoryKey: 'reboque',
    defaultAxleConfig: AXLE_CONFIG_TRANSBORDO_REBOQUE_2E_4R,
    description: 'Vagões forrageiros e reboques agrícolas de alta flutuação',
  },
  {
    id: 'vt_utilitario',
    name: 'Veículo Utilitário / Apoio',
    categoryKey: 'utilitario',
    defaultAxleConfig: AXLE_CONFIG_UTILITARIO_2E_4R,
    description: 'Caminhonetes, furgões e carros de apoio da equipe',
  },
  {
    id: 'vt_onibus',
    name: 'Ônibus / Van de Equipe',
    categoryKey: 'onibus',
    defaultAxleConfig: AXLE_CONFIG_CAMINHAO_TOCO_2E_6R,
    description: 'Transporte de colaboradores da equipe de corte',
  },
  {
    id: 'vt_outro',
    name: 'Outro Equipamento',
    categoryKey: 'outro',
    defaultAxleConfig: AXLE_CONFIG_UTILITARIO_2E_4R,
    description: 'Equipamentos e chassis especiais sob demanda',
  },
];

// ========================================================
// FUNÇÕES AUXILIARES DE NOMES E POSIÇÕES DOS PNEUS
// ========================================================

export function getPositionReadableLabel(pos: string): string {
  const map: Record<string, string> = {
    '1E': '1º Eixo - Esquerdo',
    '1D': '1º Eixo - Direito',
    '2E': '2º Eixo - Esquerdo',
    '2D': '2º Eixo - Direito',
    '2EE': '2º Eixo - Esquerdo Externo',
    '2EI': '2º Eixo - Esquerdo Interno',
    '2DI': '2º Eixo - Direito Interno',
    '2DD': '2º Eixo - Direito Externo',
    '3EE': '3º Eixo - Esquerdo Externo',
    '3EI': '3º Eixo - Esquerdo Interno',
    '3DI': '3º Eixo - Direito Interno',
    '3DD': '3º Eixo - Direito Externo',
    '4EE': '4º Eixo - Esquerdo Externo',
    '4EI': '4º Eixo - Esquerdo Interno',
    '4DI': '4º Eixo - Direito Interno',
    '4DD': '4º Eixo - Direito Externo',
  };
  return map[pos] || `Posição ${pos}`;
}

export function getTireCondition(treadMm: number): {
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
} {
  if (treadMm >= 12) {
    return {
      label: 'Excelente / Novo',
      color: '#10b981',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      borderClass: 'border-emerald-500',
    };
  }
  if (treadMm >= 7) {
    return {
      label: 'Bom Estado',
      color: '#0ea5e9',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/60',
      badgeText: 'text-sky-700 dark:text-sky-400',
      borderClass: 'border-sky-500',
    };
  }
  if (treadMm >= 4) {
    return {
      label: 'Atenção / Meia-Vida',
      color: '#f59e0b',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-500',
    };
  }
  if (treadMm >= 1.6) {
    return {
      label: 'Crítico / Limite TWI',
      color: '#f97316',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
      badgeText: 'text-orange-700 dark:text-orange-400',
      borderClass: 'border-orange-500',
    };
  }
  return {
    label: 'Descarte / Risco',
    color: '#ef4444',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-500',
  };
}

// Gera pneus iniciais para um veículo caso não tenha pneus cadastrados
export function generateDefaultTiresForAxleConfig(
  axleConfig: VehicleAxleConfig,
  plateOrName: string = 'FROTA'
): TireItem[] {
  const tires: TireItem[] = [];
  let index = 1;

  axleConfig.axles.forEach((axle) => {
    axle.tirePositions.forEach((pos) => {
      const isFront = axle.axleNumber === 1;
      const initialTread = isFront ? 14.5 : 13.0;

      tires.push({
        id: `tire_${plateOrName.replace(/\W/g, '').toLowerCase()}_${pos}_${Date.now()}_${index}`,
        position: pos,
        positionName: getPositionReadableLabel(pos),
        fireNumber: `${plateOrName.slice(0, 3).toUpperCase() || 'P'}-${100 + index}`,
        brand: isFront ? 'Michelin' : 'Bridgestone',
        model: isFront ? 'X Multi Z' : 'M729 Tração',
        size: '295/80 R22.5',
        treadDepthMm: initialTread,
        originalTreadDepthMm: 18.0,
        pressurePsi: 110,
        status: 'em_uso',
        retreadCount: 0,
        notes: 'Pneu montado de fábrica',
      });
      index++;
    });
  });

  return tires;
}

// ========================================================
// ALGORITMOS DE CÁLCULO DE RODÍZIO DE PNEUS
// ========================================================

export function calculateRotationPlan(
  tires: TireItem[],
  axleConfig: VehicleAxleConfig,
  pattern: RotationPatternType
): { newPositions: Record<string, string>; movements: TireMovement[] } {
  const currentByPos = new Map<string, TireItem>();
  tires.forEach((t) => currentByPos.set(t.position, t));

  const newPositions: Record<string, string> = {}; // fromPos -> toPos

  if (pattern === 'mesmo_eixo') {
    // Inversão de lado no mesmo eixo (E <-> D)
    axleConfig.axles.forEach((axle) => {
      if (axle.type === 'single') {
        const [posE, posD] = axle.tirePositions;
        if (posE && posD) {
          newPositions[posE] = posD;
          newPositions[posD] = posE;
        }
      } else {
        // Dual: EE <-> DD, EI <-> DI
        const [posEE, posEI, posDI, posDD] = axle.tirePositions;
        if (posEE && posDD) {
          newPositions[posEE] = posDD;
          newPositions[posDD] = posEE;
        }
        if (posEI && posDI) {
          newPositions[posEI] = posDI;
          newPositions[posDI] = posEI;
        }
      }
    });
  } else if (pattern === 'cruzado_x') {
    // Cruzamento em X (Dianteira cruza para Traseira, Traseira sobe em linha reta ou cruza)
    if (axleConfig.totalAxles === 2) {
      if (axleConfig.axles[0].type === 'single' && axleConfig.axles[1].type === 'single') {
        newPositions['1E'] = '2D';
        newPositions['1D'] = '2E';
        newPositions['2E'] = '1E';
        newPositions['2D'] = '1D';
      } else if (axleConfig.axles[0].type === 'single' && axleConfig.axles[1].type === 'dual') {
        newPositions['1E'] = '2DD';
        newPositions['1D'] = '2EE';
        newPositions['2EE'] = '1D';
        newPositions['2DD'] = '1E';
        newPositions['2EI'] = '2DI';
        newPositions['2DI'] = '2EI';
      }
    } else if (axleConfig.totalAxles >= 3) {
      // 3 Eixos Trucado
      newPositions['1E'] = '3DD';
      newPositions['1D'] = '3EE';
      newPositions['3EE'] = '2EE';
      newPositions['3DD'] = '2DD';
      newPositions['2EE'] = '1E';
      newPositions['2DD'] = '1D';
      newPositions['2EI'] = '3DI';
      newPositions['2DI'] = '3EI';
      newPositions['3EI'] = '2EI';
      newPositions['3DI'] = '2DI';
    }
  } else if (pattern === 'eixos_diferentes') {
    // Direto Frente <-> Trás no mesmo lado
    if (axleConfig.totalAxles === 2) {
      if (axleConfig.axles[1].type === 'single') {
        newPositions['1E'] = '2E';
        newPositions['1D'] = '2D';
        newPositions['2E'] = '1E';
        newPositions['2D'] = '1D';
      } else {
        newPositions['1E'] = '2EE';
        newPositions['1D'] = '2DD';
        newPositions['2EE'] = '1E';
        newPositions['2DD'] = '1D';
        newPositions['2EI'] = '2DI';
        newPositions['2DI'] = '2EI';
      }
    } else if (axleConfig.totalAxles >= 3) {
      newPositions['1E'] = '2EE';
      newPositions['1D'] = '2DD';
      newPositions['2EE'] = '3EE';
      newPositions['2DD'] = '3DD';
      newPositions['3EE'] = '1E';
      newPositions['3DD'] = '1D';
      newPositions['2EI'] = '3EI';
      newPositions['2DI'] = '3DI';
      newPositions['3EI'] = '2EI';
      newPositions['3DI'] = '2DI';
    }
  } else if (pattern === 'tracao_duplo') {
    // Rodízio Interno x Externo dos eixos de tração / truck
    axleConfig.axles.forEach((axle) => {
      if (axle.type === 'dual') {
        const [posEE, posEI, posDI, posDD] = axle.tirePositions;
        if (posEE && posEI && posDI && posDD) {
          // Inverte Interno com Externo
          newPositions[posEE] = posEI;
          newPositions[posEI] = posEE;
          newPositions[posDD] = posDI;
          newPositions[posDI] = posDD;
        }
      }
    });
  }

  // Preenche posições que não foram alteradas
  axleConfig.axles.forEach((axle) => {
    axle.tirePositions.forEach((p) => {
      if (!newPositions[p]) {
        newPositions[p] = p;
      }
    });
  });

  // Constrói lista de movimentos
  const movements: TireMovement[] = [];
  Object.entries(newPositions).forEach(([fromPos, toPos]) => {
    if (fromPos !== toPos) {
      const tire = currentByPos.get(fromPos);
      if (tire) {
        movements.push({
          tireId: tire.id,
          fireNumber: tire.fireNumber,
          fromPosition: fromPos,
          toPosition: toPos,
          treadDepthMm: tire.treadDepthMm,
        });
      }
    }
  });

  return { newPositions, movements };
}
