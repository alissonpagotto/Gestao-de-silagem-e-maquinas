import React, { useEffect, useState } from 'react';
import { Maximize2, Palette, RotateCcw, Save, X } from 'lucide-react';
import { Employee } from '../../types';
import { EmployeeBadgeCard } from './EmployeeBadgeCard';
import {
  BADGE_SIZE_PRESETS,
  BadgeSizePreset,
  BadgeStyleTemplate,
  BadgeThemeConfig,
  DEFAULT_BADGE_THEME,
  getBadgeDimensions,
} from './badgeTheme';

interface BadgeCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: BadgeThemeConfig;
  onSaveTheme: (theme: BadgeThemeConfig) => void;
  previewEmployee?: Employee;
  previewRegistrationNumber: string;
  companyName: string;
  companyLogoUrl?: string;
}

const STYLE_OPTIONS: {
  id: BadgeStyleTemplate;
  label: string;
  description: string;
}[] = [
  {
    id: 'classic',
    label: 'Clássico Corporativo',
    description: 'Cabeçalho sólido e foto 3×4 tradicional',
  },
  {
    id: 'modern_agro',
    label: 'Moderno Agro',
    description: 'Foto circular sobreposta e faixa destaque',
  },
  {
    id: 'minimal_clean',
    label: 'Minimalista Clean',
    description: 'Topo fino colorido e visual leve',
  },
];

const SIZE_ORDER: BadgeSizePreset[] = ['pvc_54x86', 'medium_70x100', 'large_85x120'];

const FALLBACK_PREVIEW_EMPLOYEE: Partial<Employee> & { name: string } = {
  id: 'preview_emp',
  name: 'JOÃO CARLOS DA SILVA',
  role: 'Operador de Forrageira',
  cpf: '091.452.789-00',
  admissionDate: '2026-01-15',
  phone: '',
  status: 'ativo',
};

export const BadgeCustomizeModal: React.FC<BadgeCustomizeModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSaveTheme,
  previewEmployee,
  previewRegistrationNumber,
  companyName,
  companyLogoUrl,
}) => {
  const [draftTheme, setDraftTheme] = useState<BadgeThemeConfig>(currentTheme);

  useEffect(() => {
    if (isOpen) {
      setDraftTheme({ ...currentTheme });
    }
  }, [isOpen, currentTheme]);

  if (!isOpen) return null;

  const handleHexChange = (
    key: 'headerColor' | 'bodyBgColor' | 'textColor' | 'accentColor',
    raw: string
  ) => {
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    setDraftTheme((prev) => ({ ...prev, [key]: cleaned.slice(0, 7) }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
    const sanitized: BadgeThemeConfig = {
      ...draftTheme,
      headerColor: isValidHex(draftTheme.headerColor)
        ? draftTheme.headerColor.toLowerCase()
        : DEFAULT_BADGE_THEME.headerColor,
      bodyBgColor: isValidHex(draftTheme.bodyBgColor)
        ? draftTheme.bodyBgColor.toLowerCase()
        : DEFAULT_BADGE_THEME.bodyBgColor,
      textColor: isValidHex(draftTheme.textColor)
        ? draftTheme.textColor.toLowerCase()
        : DEFAULT_BADGE_THEME.textColor,
      accentColor: isValidHex(draftTheme.accentColor)
        ? draftTheme.accentColor.toLowerCase()
        : DEFAULT_BADGE_THEME.accentColor,
    };
    onSaveTheme(sanitized);
    onClose();
  };

  const handleRestoreDefaults = () => {
    setDraftTheme({ ...DEFAULT_BADGE_THEME });
  };

  const sampleEmployee = previewEmployee || FALLBACK_PREVIEW_EMPLOYEE;
  const sampleReg = previewRegistrationNumber || '09101';
  const activeDims = getBadgeDimensions(draftTheme.size);

  const colorFields: {
    key: 'headerColor' | 'bodyBgColor' | 'textColor' | 'accentColor';
    label: string;
  }[] = [
    { key: 'headerColor', label: 'Cor do Cabeçalho / Topo do Crachá' },
    { key: 'bodyBgColor', label: 'Cor de Fundo do Corpo do Crachá' },
    { key: 'textColor', label: 'Cor Principal dos Textos (Nome e Dados)' },
    { key: 'accentColor', label: 'Cor da Tarja / Badge do Cargo e Registro' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print overflow-hidden">
      <div className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho do Modal - Tema Oficial */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 text-black dark:text-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 flex items-center justify-center shadow-2xs shrink-0">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100">
                Personalizar Layout &amp; Cores do Crachá
              </h3>
              <p className="text-[11px] text-stone-700 dark:text-stone-400 font-medium">
                Ajuste o modelo visual, dimensões físicas, paleta de cores e campos visíveis na impressão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-white/60 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo em 2 Colunas */}
        <form
          id="badge-customize-form"
          onSubmit={handleSave}
          className="p-3 sm:p-4 overflow-y-auto flex-1 bg-[#cad4e6] dark:bg-stone-900"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* COLUNA ESQUERDA: CONTROLES DE PERSONALIZAÇÃO */}
            <div className="lg:col-span-7 space-y-3">
              {/* Card 1: Seletor de Estilo / Modelo */}
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                  1. Estilo / Modelo do Crachá
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const active = draftTheme.style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({ ...prev, style: opt.id }))
                        }
                        className={`text-left p-2.5 rounded-lg border transition cursor-pointer ${
                          active
                            ? 'bg-white border-2 border-emerald-600 shadow-2xs'
                            : 'bg-white/90 border-gray-400 hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-black leading-tight">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium mt-0.5 leading-snug">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Dimensão / Tamanho do Crachá */}
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-black/15">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200">
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Dimensão / Tamanho do Crachá</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-stone-300">
                    {activeDims.columnsPerA4Row} crachás por linha no A4
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SIZE_ORDER.map((sizeId) => {
                    const preset = BADGE_SIZE_PRESETS[sizeId];
                    const active = draftTheme.size === sizeId;
                    return (
                      <button
                        key={sizeId}
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({ ...prev, size: sizeId }))
                        }
                        className={`text-left p-2.5 rounded-lg border transition cursor-pointer flex items-start gap-2 ${
                          active
                            ? 'bg-white border-2 border-emerald-600 shadow-2xs'
                            : 'bg-white/90 border-gray-400 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            active ? 'border-emerald-600' : 'border-gray-400'
                          }`}
                        >
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-black leading-tight">
                            {preset.label}
                          </div>
                          <div className="text-[10px] text-slate-600 font-medium mt-0.5 leading-snug">
                            {preset.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Cores Personalizáveis */}
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                  2. Cores Personalizáveis
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {colorFields.map(({ key, label }) => {
                    const currentVal = draftTheme[key];
                    const safePickerColor = /^#[0-9a-fA-F]{6}$/.test(currentVal)
                      ? currentVal
                      : DEFAULT_BADGE_THEME[key];
                    return (
                      <div
                        key={key}
                        className="bg-white border border-gray-400 rounded-lg p-2 space-y-1.5"
                      >
                        <label className="block text-[11px] font-bold text-black leading-tight">
                          {label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={safePickerColor}
                            onChange={(e) =>
                              setDraftTheme((prev) => ({
                                ...prev,
                                [key]: e.target.value.toLowerCase(),
                              }))
                            }
                            className="w-8 h-7 p-0.5 bg-white border border-gray-400 rounded cursor-pointer shrink-0"
                            title={label}
                          />
                          <input
                            type="text"
                            value={currentVal.toUpperCase()}
                            onChange={(e) => handleHexChange(key, e.target.value)}
                            maxLength={7}
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-gray-400 rounded text-black font-mono text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Opções de Exibição + Restaurar Padrão */}
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                  3. Opções de Exibição no Crachá
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draftTheme.showLogo}
                      onChange={(e) =>
                        setDraftTheme((prev) => ({
                          ...prev,
                          showLogo: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-black">
                      Exibir Logo da Empresa no topo
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draftTheme.showCpf}
                      onChange={(e) =>
                        setDraftTheme((prev) => ({
                          ...prev,
                          showCpf: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-black">
                      Exibir CPF no rodapé do crachá
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draftTheme.showAdmissionDate}
                      onChange={(e) =>
                        setDraftTheme((prev) => ({
                          ...prev,
                          showAdmissionDate: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-black">
                      Exibir Data de Admissão no rodapé
                    </span>
                  </label>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black text-xs font-bold border border-gray-400 shadow-2xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
                    <span>Restaurar Padrão Original</span>
                  </button>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO EM TEMPO REAL */}
            <div className="lg:col-span-5 bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 flex flex-col items-center justify-center space-y-2.5">
              <div className="w-full text-center pb-1.5 border-b border-black/15">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200">
                  Pré-visualização em Tempo Real
                </div>
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">
                  Dimensão real: {activeDims.widthMm}mm × {activeDims.heightMm}mm
                </div>
              </div>

              <div className="w-full py-2 flex items-center justify-center overflow-x-auto">
                <EmployeeBadgeCard
                  employee={sampleEmployee}
                  registrationNumber={sampleReg}
                  companyName={companyName}
                  companyLogoUrl={companyLogoUrl}
                  theme={draftTheme}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Rodapé do Modal */}
        <div className="px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-gray-400 dark:border-stone-600 text-black dark:text-stone-200 bg-white hover:bg-gray-100 text-xs font-bold transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="badge-customize-form"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-700 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>Salvar Personalização</span>
          </button>
        </div>
      </div>
    </div>
  );
};
