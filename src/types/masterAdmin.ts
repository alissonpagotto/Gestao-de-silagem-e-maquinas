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

export interface SiteConfig {
  // Bloco Hero
  heroTitle: string; // TÍTULO PRINCIPAL (H1)
  heroSubtitle: string; // SUBTÍTULO
  heroPrimaryBtnText: string; // TEXTO BOTÃO PRINCIPAL
  heroSecondaryBtnText: string; // TEXTO BOTÃO SECUNDÁRIO

  // Bloco Cabeçalho de Recursos
  featuresSectionTitle: string; // TÍTULO DA SEÇÃO
  featuresSectionSubtitle: string; // SUBTÍTULO DA SEÇÃO

  // Bloco Recursos (Benefícios - 4 itens)
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  feature4Title: string;
  feature4Desc: string;
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
}
