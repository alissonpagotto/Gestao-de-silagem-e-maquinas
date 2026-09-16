import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Layers, 
  CircleDot, 
  Info,
  CheckCircle2,
  Car
} from 'lucide-react';
import { VehicleTypeDefinition, VehicleAxleConfig } from '../../types';
import { 
  AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R,
  AXLE_CONFIG_CAMINHAO_TOCO_2E_6R,
  AXLE_CONFIG_UTILITARIO_2E_4R,
  AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R,
  AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R,
  AXLE_CONFIG_TRANSBORDO_REBOQUE_2E_4R,
  AXLE_CONFIG_BITRUCK_4E_12R
} from '../../lib/tireAndAxlePresets';

interface VehicleTypesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleTypes: VehicleTypeDefinition[];
  onSaveVehicleTypes: (types: VehicleTypeDefinition[]) => void;
}

export const VehicleTypesConfigModal: React.FC<VehicleTypesConfigModalProps> = ({
  isOpen,
  onClose,
  vehicleTypes,
  onSaveVehicleTypes,
}) => {
  const [typesList, setTypesList] = useState<VehicleTypeDefinition[]>(vehicleTypes);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('caminhao_trucado_3e_10r');

  const presetConfigs: { key: string; label: string; config: VehicleAxleConfig }[] = [
    { key: 'caminhao_trucado_3e_10r', label: 'Caminhão Trucado (3 Eixos / 10 Rodas)', config: AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R },
    { key: 'caminhao_toco_2e_6r', label: 'Caminhão Toco (2 Eixos / 6 Rodas)', config: AXLE_CONFIG_CAMINHAO_TOCO_2E_6R },
    { key: 'utilitario_2e_4r', label: 'Utilitário / Carro / Picape (2 Eixos / 4 Rodas)', config: AXLE_CONFIG_UTILITARIO_2E_4R },
    { key: 'trator_agricola_2e_4r', label: 'Trator Agrícola (2 Eixos / 4 Rodas)', config: AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R },
    { key: 'ensiladeira_autopropelida_2e_4r', label: 'Ensiladeira Autopropelida (2 Eixos / 4 Rodas)', config: AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R },
    { key: 'transbordo_reboque_2e_4r', label: 'Transbordo / Reboque Silagem (2 Eixos / 4 Rodas)', config: AXLE_CONFIG_TRANSBORDO_REBOQUE_2E_4R },
    { key: 'bitruck_4e_12r', label: 'Caminhão Bitruck (4 Eixos / 12 Rodas)', config: AXLE_CONFIG_BITRUCK_4E_12R },
  ];

  const handleStartCreate = () => {
    setEditingTypeId('new');
    setTypeName('');
    setTypeDescription('');
    setSelectedPresetKey('caminhao_trucado_3e_10r');
  };

  const handleStartEdit = (t: VehicleTypeDefinition) => {
    setEditingTypeId(t.id);
    setTypeName(t.name);
    setTypeDescription(t.description || '');
    setSelectedPresetKey(t.defaultAxleConfig.code || 'caminhao_trucado_3e_10r');
  };

  const handleSaveItem = () => {
    if (!typeName.trim()) return;

    const chosenPreset = presetConfigs.find((p) => p.key === selectedPresetKey) || presetConfigs[0];

    if (editingTypeId === 'new') {
      const newType: VehicleTypeDefinition = {
        id: `vt_${Date.now()}`,
        name: typeName.trim(),
        categoryKey: 'personalizado',
        defaultAxleConfig: chosenPreset.config,
        description: typeDescription.trim(),
        isCustom: true,
      };
      const updated = [...typesList, newType];
      setTypesList(updated);
      onSaveVehicleTypes(updated);
    } else if (editingTypeId) {
      const updated = typesList.map((t) => {
        if (t.id === editingTypeId) {
          return {
            ...t,
            name: typeName.trim(),
            description: typeDescription.trim(),
            defaultAxleConfig: chosenPreset.config,
          };
        }
        return t;
      });
      setTypesList(updated);
      onSaveVehicleTypes(updated);
    }

    setEditingTypeId(null);
    setTypeName('');
    setTypeDescription('');
  };

  const handleDeleteItem = (id: string) => {
    if (typesList.length <= 1) return;
    const updated = typesList.filter((t) => t.id !== id);
    setTypesList(updated);
    onSaveVehicleTypes(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Tipos de Veículos &amp; Configuração de Eixos
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Personalize os tipos de frota e a quantidade padrão de eixos e pneus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Form Create / Edit */}
          {editingTypeId !== null ? (
            <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  {editingTypeId === 'new' ? 'Novo Tipo de Veículo' : 'Editar Tipo de Veículo'}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTypeId(null)}
                  className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nome do Tipo de Veículo *
                  </label>
                  <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="Ex: Caminhão Roll-on, Trator 8R, etc."
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Configuração de Eixos &amp; Pneus *
                  </label>
                  <select
                    value={selectedPresetKey}
                    onChange={(e) => setSelectedPresetKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {presetConfigs.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Descrição / Notas
                </label>
                <input
                  type="text"
                  value={typeDescription}
                  onChange={(e) => setTypeDescription(e.target.value)}
                  placeholder="Ex: Utilizado para transporte pesado de biomassa"
                  className="w-full px-3 py-2 text-xs font-normal rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={!typeName.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Tipo de Veículo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tipos disponíveis no cadastro ({typesList.length})
              </p>
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Tipo</span>
              </button>
            </div>
          )}

          {/* List of Types */}
          <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-200 dark:divide-stone-800">
            {typesList.map((t) => (
              <div
                key={t.id}
                className="p-3.5 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/40 transition gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {t.defaultAxleConfig.totalAxles} Eixos • {t.defaultAxleConfig.totalTires} Pneus
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {t.description || t.defaultAxleConfig.name}
                  </p>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(t)}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-sky-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(t.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 transition cursor-pointer"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
};
