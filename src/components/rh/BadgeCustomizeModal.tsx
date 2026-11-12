import React, { useEffect, useState } from 'react';
import { Maximize2, Minus, Palette, Plus, RotateCcw, Save, Type, X } from 'lucide-react';
import { Employee } from '../../types';
import { EmployeeBadgeCard } from './EmployeeBadgeCard';
import {
  BADGE_SIZE_PRESETS,
  BadgeSizePreset,
  BadgeStyleTemplate,
  BadgeThemeConfig,
  COMPANY_FONT_MAX,
  COMPANY_FONT_MIN,
  DEFAULT_BADGE_THEME,
  EMPLOYEE_FONT_MAX,
  EMPLOYEE_FONT_MIN,
  clampFontSize,
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
  const [draftTheme, setDraftTheme] = useState<BadgeThemeConfig>({
    ...DEFAULT_BADGE_THEME,
    ...currentTheme,
  });

  useEffect(() => {
    if (isOpen) {
      setDraftTheme({
        ...DEFAULT_BADGE_THEME,
        ...currentTheme,
      });
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
      headerSubtitle: (draftTheme.headerSubtitle || '').trim(),
      companyNameFontSize: clampFontSize(
        draftTheme.companyNameFontSize,
        COMPANY_FONT_MIN,
        COMPANY_FONT_MAX,
        DEFAULT_BADGE_THEME.companyNameFontSize
      ),
      employeeNameFontSize: clampFontSize(
        draftTheme.employeeNameFontSize,
        EMPLOYEE_FONT_MIN,
        EMPLOYEE_FONT_MAX,
        DEFAULT_BADGE_THEME.employeeNameFontSize
      ),
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

  const previewScale = draftTheme.size === 'large_85x120' ? 1.05 : 1.15;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 no-print overflow-hidden">
      <div className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-2xl w-[90vw] max-w-[90vw] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho do Modal - Tema Oficial */}
        <div className="px-4 py-2 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 text-black dark:text-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 flex items-center justify-center shadow-2xs shrink-0">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100 leading-tight">
                Personalizar Layout &amp; Cores do Crachá
              </h3>
              <p className="text-[11px] text-stone-700 dark:text-stone-400 font-medium leading-tight">
                Ajuste o modelo visual, dimensões físicas, paleta de cores, fontes e subtítulo em tempo real
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

        {/* Corpo Expandido em 1 Tela (65% Esquerda / 35% Direita) */}
        <form
          id="badge-customize-form"
          onSubmit={handleSave}
          className="p-2.5 sm:p-3 overflow-y-auto lg:overflow-hidden flex-1 bg-[#cad4e6] dark:bg-stone-900 min-h-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-3 h-full items-stretch">
            {/* PAINEL ESQUERDO (~65%): GRID DE 2 SUB-COLUNAS COMPACTAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 content-start min-w-0">
              {/* TOPO (2 Colunas): Card 1 - Estilo / Modelo */}
              <div className="md:col-span-2 bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5">
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
                        className={`text-left px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                          active
                            ? 'bg-white border-2 border-emerald-600 shadow-2xs'
                            : 'bg-white/90 border-gray-400 hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-black leading-tight">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium mt-0.5 leading-tight">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TOPO (2 Colunas): Card Dimensão / Tamanho do Crachá */}
              <div className="md:col-span-2 bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5">
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
                        className={`text-left px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-start gap-2 ${
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
                          <div className="text-[10px] text-slate-600 font-medium mt-0.5 leading-tight">
                            {preset.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SUB-COLUNA ESQUERDA: Card 2 - Cores Personalizáveis (Grid Compacto 2x2) */}
              <div className="md:col-span-1 bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5 h-full flex flex-col">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                  2. Cores Personalizáveis
                </div>
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  {colorFields.map(({ key, label }) => {
                    const currentVal = draftTheme[key];
                    const safePickerColor = /^#[0-9a-fA-F]{6}$/.test(currentVal)
                      ? currentVal
                      : DEFAULT_BADGE_THEME[key];
                    return (
                      <div
                        key={key}
                        className="bg-white border border-gray-400 rounded-lg p-1.5 flex flex-col justify-between gap-1"
                      >
                        <label className="block text-[10px] font-bold text-black leading-tight">
                          {label}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={safePickerColor}
                            onChange={(e) =>
                              setDraftTheme((prev) => ({
                                ...prev,
                                [key]: e.target.value.toLowerCase(),
                              }))
                            }
                            className="w-7 h-6 p-0.5 bg-white border border-gray-400 rounded cursor-pointer shrink-0"
                            title={label}
                          />
                          <input
                            type="text"
                            value={currentVal.toUpperCase()}
                            onChange={(e) => handleHexChange(key, e.target.value)}
                            maxLength={7}
                            className="flex-1 min-w-0 px-1.5 py-0.5 bg-white border border-gray-400 rounded text-black font-mono text-[11px] font-bold uppercase focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SUB-COLUNA DIREITA: Card 3 (Opções de Exibição) + Card 4 (Subtítulo Opcional) */}
              <div className="md:col-span-1 flex flex-col gap-2.5 h-full">
                {/* Card 3: Opções de Exibição */}
                <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                    3. Opções de Exibição no Crachá
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={draftTheme.showLogo}
                        onChange={(e) =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            showLogo: e.target.checked,
                          }))
                        }
                        className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-bold text-black leading-tight">
                        Exibir Logo da Empresa no topo
                      </span>
                    </label>

                    <label className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={draftTheme.showCpf}
                        onChange={(e) =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            showCpf: e.target.checked,
                          }))
                        }
                        className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-bold text-black leading-tight">
                        Exibir CPF no rodapé do crachá
                      </span>
                    </label>

                    <label className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-400 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={draftTheme.showAdmissionDate}
                        onChange={(e) =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            showAdmissionDate: e.target.checked,
                          }))
                        }
                        className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-bold text-black leading-tight">
                        Exibir Data de Admissão no rodapé
                      </span>
                    </label>
                  </div>
                </div>

                {/* Card 4: Subtítulo Opcional no Cabeçalho */}
                <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5 flex-1 flex flex-col justify-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                    4. Subtítulo do Cabeçalho (Opcional)
                  </div>
                  <input
                    type="text"
                    value={draftTheme.headerSubtitle || ''}
                    onChange={(e) =>
                      setDraftTheme((prev) => ({
                        ...prev,
                        headerSubtitle: e.target.value,
                      }))
                    }
                    placeholder="Ex: Equipe de Campo, Operador, ou deixe vazio..."
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-400 rounded-lg text-xs font-bold text-black placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* BASE (2 Colunas): Card 5 - Tamanho das Fontes + Botão Restaurar Padrão Original na mesma linha */}
              <div className="md:col-span-2 bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200 pb-1 border-b border-black/15">
                  <Type className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>5. Tamanho das Fontes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-2 items-stretch">
                  {/* Fonte do Nome da Empresa */}
                  <div className="bg-white border border-gray-400 rounded-lg px-2.5 py-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-black leading-tight">
                        Fonte do Nome da Empresa
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-gray-300 text-[10px] font-mono font-bold text-black shrink-0">
                        {draftTheme.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            companyNameFontSize: clampFontSize(
                              (prev.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize) - 1,
                              COMPANY_FONT_MIN,
                              COMPANY_FONT_MAX,
                              DEFAULT_BADGE_THEME.companyNameFontSize
                            ),
                          }))
                        }
                        disabled={(draftTheme.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize) <= COMPANY_FONT_MIN}
                        className="w-6 h-6 rounded border border-gray-400 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer disabled:cursor-not-allowed shrink-0"
                        title="Diminuir fonte da empresa"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min={COMPANY_FONT_MIN}
                        max={COMPANY_FONT_MAX}
                        step={1}
                        value={draftTheme.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize}
                        onChange={(e) =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            companyNameFontSize: clampFontSize(
                              e.target.value,
                              COMPANY_FONT_MIN,
                              COMPANY_FONT_MAX,
                              DEFAULT_BADGE_THEME.companyNameFontSize
                            ),
                          }))
                        }
                        className="flex-1 min-w-0 accent-emerald-600 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            companyNameFontSize: clampFontSize(
                              (prev.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize) + 1,
                              COMPANY_FONT_MIN,
                              COMPANY_FONT_MAX,
                              DEFAULT_BADGE_THEME.companyNameFontSize
                            ),
                          }))
                        }
                        disabled={(draftTheme.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize) >= COMPANY_FONT_MAX}
                        className="w-6 h-6 rounded border border-gray-400 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer disabled:cursor-not-allowed shrink-0"
                        title="Aumentar fonte da empresa"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Fonte do Nome do Funcionário */}
                  <div className="bg-white border border-gray-400 rounded-lg px-2.5 py-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-black leading-tight">
                        Fonte do Nome do Funcionário
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-gray-300 text-[10px] font-mono font-bold text-black shrink-0">
                        {draftTheme.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            employeeNameFontSize: clampFontSize(
                              (prev.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize) - 1,
                              EMPLOYEE_FONT_MIN,
                              EMPLOYEE_FONT_MAX,
                              DEFAULT_BADGE_THEME.employeeNameFontSize
                            ),
                          }))
                        }
                        disabled={(draftTheme.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize) <= EMPLOYEE_FONT_MIN}
                        className="w-6 h-6 rounded border border-gray-400 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer disabled:cursor-not-allowed shrink-0"
                        title="Diminuir fonte do funcionário"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min={EMPLOYEE_FONT_MIN}
                        max={EMPLOYEE_FONT_MAX}
                        step={1}
                        value={draftTheme.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize}
                        onChange={(e) =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            employeeNameFontSize: clampFontSize(
                              e.target.value,
                              EMPLOYEE_FONT_MIN,
                              EMPLOYEE_FONT_MAX,
                              DEFAULT_BADGE_THEME.employeeNameFontSize
                            ),
                          }))
                        }
                        className="flex-1 min-w-0 accent-emerald-600 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraftTheme((prev) => ({
                            ...prev,
                            employeeNameFontSize: clampFontSize(
                              (prev.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize) + 1,
                              EMPLOYEE_FONT_MIN,
                              EMPLOYEE_FONT_MAX,
                              DEFAULT_BADGE_THEME.employeeNameFontSize
                            ),
                          }))
                        }
                        disabled={(draftTheme.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize) >= EMPLOYEE_FONT_MAX}
                        className="w-6 h-6 rounded border border-gray-400 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer disabled:cursor-not-allowed shrink-0"
                        title="Aumentar fonte do funcionário"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Botão Restaurar Padrão Original alinhado na mesma linha */}
                  <div className="sm:col-span-2 lg:col-span-1 flex items-center">
                    <button
                      type="button"
                      onClick={handleRestoreDefaults}
                      className="w-full h-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black text-xs font-bold border border-gray-400 shadow-2xs transition cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>Restaurar Padrão Original</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PAINEL DIREITO (~35%): PRÉ-VISUALIZAÇÃO EM TEMPO REAL FIXA E AMPLIADA */}
            <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5 flex flex-col items-center justify-between h-full min-h-[380px] overflow-hidden">
              <div className="w-full text-center pb-1.5 border-b border-black/15 shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-stone-200">
                  Pré-visualização em Tempo Real
                </div>
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">
                  Dimensão real: {activeDims.widthMm}mm × {activeDims.heightMm}mm
                </div>
              </div>

              <div className="w-full flex-1 flex items-center justify-center py-4 overflow-hidden">
                <div
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'center center',
                  }}
                >
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
          </div>
        </form>

        {/* Rodapé do Modal */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end gap-2 shrink-0">
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
