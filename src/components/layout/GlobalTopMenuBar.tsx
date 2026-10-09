import React, { useState, useRef, useEffect } from 'react';

export interface GlobalTopMenuBarProps {
  onNavigate: (tab: string) => void;
  onOpenReorderMenu: () => void;
  onOpenHelp: () => void;
}

export const GlobalTopMenuBar: React.FC<GlobalTopMenuBarProps> = ({
  onNavigate,
  onOpenReorderMenu,
  onOpenHelp,
}) => {
  // 1. ESTADO REATIVO
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
  const [isClientesSubOpen, setIsClientesSubOpen] = useState(false);
  const cadastrosMenuRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cadastrosMenuRef.current &&
        !cadastrosMenuRef.current.contains(event.target as Node)
      ) {
        setIsCadastrosOpen(false);
        setIsClientesSubOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ROTAS OFFLINE ATIVAS
  const handleSelect = (tab: string) => {
    setIsCadastrosOpen(false);
    setIsClientesSubOpen(false);
    onNavigate(tab);
  };

  return (
    <div className="w-full py-0.5 px-2 bg-slate-100 dark:bg-stone-850 border-b border-slate-300 dark:border-stone-700 flex items-center gap-0.5 relative z-50 select-none leading-none min-h-[22px] overflow-visible">
      {/* ITEM PAI CADASTROS: GATILHOS DE CLIQUE E HOVER */}
      <div
        ref={cadastrosMenuRef}
        className="relative inline-block"
        onMouseEnter={() => setIsCadastrosOpen(true)}
        onMouseLeave={() => {
          setIsCadastrosOpen(false);
          setIsClientesSubOpen(false);
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCadastrosOpen((prev) => !prev);
          }}
          className={`text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] ${
            isCadastrosOpen ? 'bg-slate-200 dark:bg-stone-700 font-semibold' : ''
          } dark:text-stone-200 dark:hover:bg-stone-700/60`}
        >
          CADASTROS
        </button>

        {/* SUBMENU VERTICAL PRINCIPAL DE CADASTROS (PRINT 1 - SLIM & NEGRITADO) */}
        {isCadastrosOpen && (
          <div 
            className="absolute top-full left-0 z-[100] bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 shadow-md py-0.5 w-60 text-xs font-bold text-slate-800 dark:text-stone-200 tracking-wide uppercase select-none overflow-visible"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            {/* 1. CLIENTES (F3) COM SUBMENU DE SEGUNDO NÍVEL E SETA INDICATIVA */}
            <div
              className="relative"
              onMouseEnter={() => setIsClientesSubOpen(true)}
              onMouseLeave={() => setIsClientesSubOpen(false)}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('clientes');
                }}
                className={`w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer ${
                  isClientesSubOpen
                    ? 'bg-[#0056b3] text-white'
                    : 'hover:bg-[#0056b3] hover:text-white'
                }`}
              >
                <span>CLIENTES (F3)</span>
                <span className="font-bold text-[11px] ml-2">➔</span>
              </div>

              {/* SUBMENU DE SEGUNDO NÍVEL (CASCATA DO "CLIENTES" - PRINT 1/2) */}
              {isClientesSubOpen && (
                <div 
                  className="absolute left-full top-0 z-[110] bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 shadow-md py-0.5 w-56 text-xs font-bold text-slate-800 dark:text-stone-200 tracking-wide uppercase select-none"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect('clientes');
                    }}
                    className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
                  >
                    <span>CADASTRO DE CLIENTES</span>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect('clientes');
                    }}
                    className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
                  >
                    <span>CONVÊNIOS</span>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect('clientes');
                    }}
                    className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
                  >
                    <span>DEPENDENTES</span>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect('clientes');
                    }}
                    className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
                  >
                    <span>SITUAÇÃO CLIENTE</span>
                    <span className="text-[10px] opacity-90 font-bold ml-1">(CTRL+C)</span>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect('clientes');
                    }}
                    className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
                  >
                    <span>CLASSES</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. PRODUTOS (F2) */}
            <div
              onClick={() => handleSelect('estoque')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>PRODUTOS (F2)</span>
              <span className="font-bold text-[11px] ml-2">➔</span>
            </div>

            {/* 3. FORNECEDORES (F4) */}
            <div
              onClick={() => handleSelect('fornecedores')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>FORNECEDORES (F4)</span>
              <span className="font-bold text-[11px] ml-2">➔</span>
            </div>

            {/* 4. MODALIDADES DE PAGAMENTO */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>MODALIDADES DE PAGAMENTO</span>
            </div>

            {/* 5. CONDIÇÕES DE PAGAMENTO */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>CONDIÇÕES DE PAGAMENTO</span>
            </div>

            {/* 6. OPERADORAS DE CARTÃO */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>OPERADORAS DE CARTÃO</span>
            </div>

            {/* 7. LOCALIDADES */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>LOCALIDADES</span>
              <span className="font-bold text-[11px] ml-2">➔</span>
            </div>

            {/* 8. FUNCIONÁRIOS */}
            <div
              onClick={() => handleSelect('funcionarios')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>FUNCIONÁRIOS</span>
            </div>

            {/* 9. EMPRESAS */}
            <div
              onClick={() => handleSelect('configuracoes')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>EMPRESAS</span>
              <span className="font-bold text-[11px] ml-2">➔</span>
            </div>

            {/* 10. TIPOS */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>TIPOS</span>
            </div>

            {/* 11. CONTATOS */}
            <div
              onClick={() => handleSelect('clientes')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>CONTATOS</span>
            </div>

            {/* 12. SETORES */}
            <div
              onClick={() => handleSelect('cadastros_base_centros_custo')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>SETORES</span>
            </div>

            {/* 13. ESTADOS CIVIS */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>ESTADOS CIVIS</span>
            </div>

            {/* 14. ESCOLARIDADES */}
            <div
              onClick={() => handleSelect('cadastros_base')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>ESCOLARIDADES</span>
            </div>

            {/* 15. CARTAS DE COBRANÇA */}
            <div
              onClick={() => handleSelect('receber')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>CARTAS DE COBRANÇA</span>
            </div>

            {/* 16. LOGÍSTICA */}
            <div
              onClick={() => handleSelect('frotas')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>LOGÍSTICA</span>
              <span className="font-bold text-[11px] ml-2">➔</span>
            </div>

            {/* 17. STATUS CRÉDITO */}
            <div
              onClick={() => handleSelect('clientes')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>STATUS CRÉDITO</span>
            </div>

            {/* 18. CONTRATOS */}
            <div
              onClick={() => handleSelect('venda')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>CONTRATOS</span>
            </div>

            {/* 19. INTERMEDIADOR FINANCEIRO */}
            <div
              onClick={() => handleSelect('contas')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>INTERMEDIADOR FINANCEIRO</span>
            </div>

            {/* 20. PROMOÇÕES */}
            <div
              onClick={() => handleSelect('venda')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>PROMOÇÕES</span>
            </div>

            {/* 21. SERVIÇOS */}
            <div
              onClick={() => handleSelect('servicos')}
              className="w-full px-2 py-1 flex items-center justify-between transition-colors cursor-pointer hover:bg-[#0056b3] hover:text-white"
            >
              <span>SERVIÇOS</span>
            </div>
          </div>
        )}
      </div>

      {/* DEMAIS LINKS DA BARRA SUPERIOR (SLIM DESIGN PRINT 2) */}
      <span
        onClick={() => onNavigate('pagar')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        CONTAS A PAGAR
      </span>
      <span
        onClick={() => onNavigate('receber')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        CONTAS A RECEBER
      </span>
      <span
        onClick={() => onNavigate('venda')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        VENDAS
      </span>
      <span
        onClick={() => onNavigate('financeiro')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        FINANCEIRO
      </span>
      <span
        onClick={() => onNavigate('cadastros_base_plano_contas')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        CONTÁBIL
      </span>
      <span
        onClick={() => onNavigate('clientes')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        COMUNICAÇÃO
      </span>
      <span
        onClick={() => onNavigate('estoque')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        ESTOQUE
      </span>
      <span
        onClick={() => onNavigate('relatorios')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        RELATÓRIOS
      </span>
      <span
        onClick={() => onNavigate('dashboard')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        MÓDULOS
      </span>
      <span
        onClick={() => onNavigate('configuracoes')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        SISTEMA
      </span>
      <span
        onClick={() => window.open('https://web.whatsapp.com', '_blank', 'noopener,noreferrer')}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        WHATSAPP
      </span>
      <span
        onClick={onOpenReorderMenu}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        MENUS DINÂMICOS
      </span>
      <span
        onClick={onOpenHelp}
        className="text-[11px] font-normal text-slate-800 tracking-normal hover:bg-slate-200 px-1.5 py-0.5 transition-colors cursor-pointer select-none rounded-[2px] dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        AJUDA
      </span>
    </div>
  );
};
