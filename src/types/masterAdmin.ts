export type SubscriberStatus = 'ativa' | 'trial' | 'inadimplente' | 'cancelada' | 'suspensa';

export interface Subscriber {
  id: string;
  name: string; // NOME DO ASSINANTE
  responsibleEmail: string; // EMAIL DO RESPONSÁVEL
  password?: string; // SENHA
  trialUntil: string; // TRIAL ATÉ (Data YYYY-MM-DD)
  cpfCnpj: string; // CPF OU CNPJ
  stateRegistration?: string; // INSCRIÇÃO ESTADUAL
  phone: string; // TELEFONE
  cep: string; // CEP
  street: string; // LOGRADOURO
  number: string; // Nº
  neighborhood: string; // BAIRRO
  city: string; // CIDADE
  state: string; // ESTADO
  planId: string; // PLANO VINCULADO
  planName: string; // NOME DO PLANO
  monthlyValue: number; // VALOR MENSAL (para cálculo do MRR)
  status: SubscriberStatus; // STATUS DA ASSINATURA
  createdAt: string;
  updatedAt: string;
}

export interface FeatureTabItem {
  id: string;
  title: string;
  iconName?: string;
  description: string;
  bullets?: string[];
  imageUrl?: string;
}

export interface SiteConfig {
  // Configurações Gerais da Empresa / Site
  logoUrl?: string;
  companyName?: string;
  primaryColor?: string;
  maintenanceMode?: boolean;

  // 1. BLOCO DE CONFIGURAÇÃO GLOBAL (TRIAL TOGGLE)
  allow_free_trial?: boolean; // PERÍODO DE TESTE GRÁTIS ATIVO NA LANDING PAGE

  // 2. 1. BLOCO HERO (TOPO DA PÁGINA) & MÍDIA
  hero_badge_text?: string; // Frase verde superior ("A plataforma nº 1...")
  heroTitle: string; // TÍTULO PRINCIPAL (H1)
  heroSubtitle: string; // SUBTÍTULO
  heroPrimaryBtnText: string; // TEXTO BOTÃO PRINCIPAL
  heroSecondaryBtnText: string; // TEXTO BOTÃO SECUNDÁRIO
  heroBackgroundImage?: string; // IMAGEM DE FUNDO DO HERO (URL OU /image.png)
  hero_video_url?: string; // URL DO VÍDEO DEMONSTRATIVO
  hero_overlay_opacity?: number; // INTENSIDADE DO FUNDO ESCURO (0 a 100%)

  // 3. 2. IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR)
  featuresHighlightImage?: string; // IMAGEM DE DESTAQUE DOS RECURSOS (SEÇÃO INFERIOR)

  // 4. 3. BLOCO CABEÇALHO DE RECURSOS (RECURSOS PROJETADOS PARA O CAMPO)
  featuresSectionTitle: string; // TÍTULO DA SEÇÃO
  featuresSectionSubtitle: string; // SUBTÍTULO DA SEÇÃO
  features_tabs?: FeatureTabItem[]; // Abas interativas do rodapé desta seção

  // 5. 4. BLOCO RECURSOS (BENEFÍCIOS - 4 CARTÕES DA LANDING PAGE)
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  feature4Title: string;
  feature4Desc: string;

  // 6. 5. SEÇÃO DE PLANOS E PREÇOS
  pricing_tag?: string; // Tag de chamada ("INVESTIMENTO TRANSPARENTE")
  pricing_title?: string; // Título da seção ("Escolha o plano ideal para a sua operação")
  pricing_subtitle?: string; // Subtítulo da seção ("Comece com 7 dias grátis...")

  // 7. 6. CONFIGURAÇÕES DO RODAPÉ (FOOTER)
  footer_copyright?: string; // Copyright e nome da empresa ("AgroControl • Silagem Fácil Pro © 2026")
  footer_signup_url?: string; // URL link rápido "Criar Conta"
  footer_login_url?: string; // URL link rápido "Painel do Assinante ERP"
}

export interface PlanLimits {
  maxUsers: number | 'unlimited';
  maxMachineries: number | 'unlimited';
  maxClients: number | 'unlimited';
  storageLimitGb: number;
}

export interface PlanDefinition {
  id: string;
  name: string; // Nome do Plano
  description: string;
  price: number; // Valor Mensal em R$
  billingCycle: 'mensal' | 'anual';
  badge?: string; // Tag de destaque (ex: "Mais Escolhido")
  isFeatured: boolean; // Chave "Destaque"
  isActive: boolean; // Chave "Status do Plano (ATIVO)" - se false, some da Landing Page
  displayOrder: number; // ORDEM DE EXIBIÇÃO
  limits: PlanLimits;
  featuresText: string; // FEATURES (UMA POR LINHA)
  checkoutUrl: string; // URL DE CHECKOUT
}

export interface AdminSettings {
  webhookKiwify: string;
  webhookCakto: string;
  webhookPerfectPay: string;
  superAdminEmails: string[];
  masterPassword?: string; // Senha Mestre de Acesso ao Painel
}

export interface MasterSession {
  email: string;
  authenticatedAt: string;
}
