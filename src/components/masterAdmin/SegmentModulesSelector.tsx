import React from 'react';
import { Check, CheckSquare, Layers, Lock, Sliders, Square } from 'lucide-react';
import { SubscriberSegmentProfile } from '../../types/masterAdmin';
import {
  ALL_SIDEBAR_MODULE_IDS,
  ALWAYS_ACCESSIBLE_MODULE_IDS,
  normalizeEnabledModules,
  resolveSegmentModulesConfig,
  SEGMENT_PRESET_LIST,
  SEGMENT_PRESETS,
  SIDEBAR_MODULE_OPTIONS,
} from '../../lib/subscriberModules';

interface SegmentModulesSelectorProps {
  segmentProfile: SubscriberSegmentProfile;
  enabledModules: string[];
  onChange: (nextSegment: SubscriberSegmentProfile, nextModules: string[]) => void;
  title?: string;
  subtitle?: string;
}

export const SegmentModulesSelector: React.FC<SegmentModulesSelectorProps> = ({
  segmentProfile,
  enabledModules,
  onChange,
  title = 'Perfil de Segmento / Módulos Ativos',
  subtitle = 'Adapta dinamicamente os módulos exibidos no Menu Lateral Esquerdo conforme o ramo de atuação.',
}) => {
  const safeResolved = resolveSegmentModulesConfig(segmentProfile, enabledModules);
  const activePreset = SEGMENT_PRESETS[safeResolved.segmentProfile];
  const enabledSet = new Set(safeResolved.enabledModules);

  const handleSelectSegment = (nextSeg: SubscriberSegmentProfile) => {
    if (nextSeg === 'personalizado') {
      // Ao entrar no modo personalizado, parte dos módulos atualmente ativos
      onChange('personalizado', normalizeEnabledModules(safeResolved.enabledModules));
      return;
    }
    const presetConfig = resolveSegmentModulesConfig(nextSeg);
    onChange(nextSeg, presetConfig.enabledModules);
  };

  const handleToggleModule = (moduleId: string) => {
    if (ALWAYS_ACCESSIBLE_MODULE_IDS.includes(moduleId)) return;
    const nextSet = new Set(safeResolved.enabledModules);
    if (nextSet.has(moduleId)) {
      nextSet.delete(moduleId);
    } else {
      nextSet.add(moduleId);
    }
    onChange('personalizado', normalizeEnabledModules(Array.from(nextSet)));
  };

  const handleSelectAllOptional = () => {
    onChange('personalizado', [...ALL_SIDEBAR_MODULE_IDS]);
  };

  const handleClearOptional = () => {
    onChange('personalizado', [...ALWAYS_ACCESSIBLE_MODULE_IDS]);
  };

  const hiddenModules = SIDEBAR_MODULE_OPTIONS.filter((m) => !enabledSet.has(m.id));

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-[#8a92a6] mb-1 uppercase tracking-wider">
          {title}
        </label>
        {subtitle && (
          <p className="text-[11px] text-[#8a92a6] mb-2 leading-relaxed">{subtitle}</p>
        )}

        <select
          value={safeResolved.segmentProfile}
          onChange={(e) => handleSelectSegment(e.target.value as SubscriberSegmentProfile)}
          className="w-full p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-xs font-bold text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none cursor-pointer transition"
        >
          {SEGMENT_PRESET_LIST.map((preset) => (
            <option key={preset.id} value={preset.id} className="bg-[#1a1d24] text-white">
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Descrição do Perfil Selecionado & Contagem */}
      <div className="p-3 bg-[#1a1d24] border border-[#2f3644] rounded-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{activePreset.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {safeResolved.enabledModules.length} de {SIDEBAR_MODULE_OPTIONS.length} módulos ativos
            </span>
            {safeResolved.segmentProfile !== 'personalizado' && (
              <button
                type="button"
                onClick={() =>
                  onChange('personalizado', normalizeEnabledModules(safeResolved.enabledModules))
                }
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#252a34] hover:bg-[#323846] text-[#d1d5db] hover:text-white border border-[#2f3644] flex items-center gap-1 transition cursor-pointer"
                title="Converter para Personalizado mantendo estes módulos"
              >
                <Sliders className="w-3 h-3" />
                <span>Ajustar Manualmente</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[#8a92a6] leading-relaxed">{activePreset.description}</p>

        {/* Preview compacto dos módulos quando preset fixo estiver ativo */}
        {safeResolved.segmentProfile !== 'personalizado' ? (
          <div className="space-y-2 pt-1 border-t border-[#2f3644]">
            <div className="flex flex-wrap gap-1.5">
              {SIDEBAR_MODULE_OPTIONS.map((mod) => {
                const isActive = enabledSet.has(mod.id);
                return (
                  <span
                    key={mod.id}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-[#252a34]/70 text-[#6b7280] border-[#2f3644] line-through'
                    }`}
                    title={mod.description}
                  >
                    {isActive && <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
                    <span>{mod.label}</span>
                  </span>
                );
              })}
            </div>
            {hiddenModules.length > 0 && (
              <p className="text-[10px] text-amber-300/90 font-medium">
                Ocultos no menu lateral: {hiddenModules.map((m) => m.label).join(', ')}.
              </p>
            )}
          </div>
        ) : (
          /* Grade de Checkboxes quando Personalizado (Seleção Manual) estiver ativo */
          <div className="space-y-2.5 pt-2 border-t border-[#2f3644]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a92a6]">
                Marque os módulos visíveis no menu lateral:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllOptional}
                  className="px-2 py-1 rounded bg-[#252a34] hover:bg-[#323846] text-[10px] font-bold text-emerald-300 border border-[#2f3644] flex items-center gap-1 transition cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Marcar Todos</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearOptional}
                  className="px-2 py-1 rounded bg-[#252a34] hover:bg-[#323846] text-[10px] font-bold text-[#d1d5db] border border-[#2f3644] flex items-center gap-1 transition cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>Somente Essenciais</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SIDEBAR_MODULE_OPTIONS.map((mod) => {
                const isChecked = enabledSet.has(mod.id);
                const isLocked = Boolean(mod.alwaysEnabled);
                return (
                  <label
                    key={mod.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition select-none ${
                      isLocked
                        ? 'bg-[#252a34]/90 border-emerald-500/30 cursor-not-allowed opacity-90'
                        : isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-400/60 cursor-pointer'
                          : 'bg-[#252a34]/50 border-[#2f3644] hover:border-[#4d576a] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => handleToggleModule(mod.id)}
                      className="mt-0.5 w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] font-bold truncate ${
                            isChecked ? 'text-white' : 'text-[#8a92a6]'
                          }`}
                        >
                          {mod.label}
                        </span>
                        {isLocked && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-300 shrink-0"
                            title="Sempre acessível para o assinante"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>Fixo</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8a92a6] line-clamp-1 mt-0.5">
                        {mod.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
