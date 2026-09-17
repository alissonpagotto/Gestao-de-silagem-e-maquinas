import React, { useRef } from 'react';
import { 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Menu,
  Sparkles
} from 'lucide-react';
import { 
  ALL_SHORTCUTS, 
  DEFAULT_SHORTCUT_IDS 
} from './CustomizeShortcutsModal';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenMobileMenu: () => void;
  onOpenQuickMemo?: () => void;
  onOpenTrialInfo?: () => void;
  selectedShortcuts?: string[];
  onOpenCustomizeShortcuts?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  onOpenTrialInfo,
  selectedShortcuts = DEFAULT_SHORTCUT_IDS,
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  // Filter and order shortcuts based on user's active choices
  const visiblePills = selectedShortcuts
    .map(id => ALL_SHORTCUTS.find(s => s.id === id))
    .filter((s): s is typeof ALL_SHORTCUTS[number] => Boolean(s));

  return (
    <div id="top-bar-container" className="no-print sticky top-0 z-30 bg-[#0963cb] dark:bg-stone-900 border-b border-blue-900/30 dark:border-stone-800 shadow-sm">
      
      {/* Top Banner: Período de Teste */}
      <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 px-4 py-1.5 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
        <div className="flex items-center space-x-2 truncate">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="font-semibold truncate">
            Período de teste — restam 5 dias.
          </span>
          <button 
            onClick={onOpenTrialInfo}
            className="underline font-bold hover:text-rose-900 dark:hover:text-rose-100 transition cursor-pointer"
          >
            Ativar agora
          </button>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-rose-600 dark:text-rose-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Silagem Fácil Pro • Modo Completo</span>
        </div>
      </div>

      {/* Horizontal Carousel & Controls Bar: Fundo azul vibrante #0963cb */}
      <div className="px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 bg-[#0963cb] dark:bg-stone-900">
        
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-white hover:bg-white/15 transition cursor-pointer"
          aria-label="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Carousel Container */}
        <div className="flex-1 flex items-center min-w-0 max-w-full overflow-hidden">
          
          {/* Scroll Left Button */}
          <button
            onClick={scrollLeft}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
            aria-label="Rolar para esquerda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Pills List - Pure buttons only, no inline edit icons */}
          <div 
            ref={carouselRef}
            className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1 px-1.5 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {visiblePills.map((pill) => {
              const Icon = pill.icon;
              const isSelected = activeTab === pill.id ||
                (pill.id === 'venda' && (activeTab === 'venda' || activeTab === 'vendas')) ||
                (pill.id === 'fiscal' && (activeTab === 'nfe_notas' || activeTab === 'nfe_importar')) ||
                (pill.id === 'frotas' && ['veiculos', 'manutencoes', 'combustivel', 'motoristas', 'equipe', 'rodizio', 'rodizio_pneus'].includes(activeTab));

              return (
                <button
                  key={pill.id}
                  id={`top-pill-${pill.id}`}
                  type="button"
                  onClick={() => setActiveTab(pill.id)}
                  className={`
                    inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer border select-none
                    ${
                      isSelected
                        ? 'bg-white text-blue-950 border-white shadow-xs dark:bg-sky-600 dark:text-white dark:border-sky-500'
                        : 'bg-blue-600/60 hover:bg-blue-600/80 text-white/95 border-blue-400/40 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700'
                    }
                  `}
                >
                  <Icon 
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-900 dark:text-white' : 'text-blue-200 dark:text-stone-300'}`} 
                  />
                  <span 
                    className={isSelected ? 'text-blue-950 dark:text-white font-bold' : 'text-white dark:text-stone-200 font-semibold'}
                  >
                    {pill.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={scrollRight}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
            aria-label="Rolar para direita"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>

    </div>
  );
};

