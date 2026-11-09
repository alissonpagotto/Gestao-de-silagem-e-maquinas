import React from 'react';
import { 
  BillingPaymentModal, 
  BillingPaymentModalProps, 
  ReceivableItem, 
  ReceivePaymentSuccessDetails, 
  InstallmentPreviewItem,
  BillingPaymentLine,
  ChequeItemForm,
  getPaymentMethodLabel,
  isInstallmentEligible,
  formatCurrencyInputBRL,
  parseCurrencyInputToFloat
} from '../services/BillingPaymentModal';

/**
 * Motor Financeiro Unificado de Recebimentos e Faturamento (AgroControl)
 * Centraliza e padroniza a lógica de quitação financeira, faturamento de ordens de serviço,
 * parcelamentos mistos, múltiplas folhas de cheque, acréscimos/juros e autenticação administrativa.
 */
export const ReceivePaymentModal: React.FC<BillingPaymentModalProps> = (props) => {
  return <BillingPaymentModal {...props} mode={props.mode || 'receiving'} />;
};

export type {
  ReceivableItem,
  ReceivePaymentSuccessDetails,
  InstallmentPreviewItem,
  BillingPaymentLine,
  ChequeItemForm,
  BillingPaymentModalProps
};

export {
  BillingPaymentModal,
  getPaymentMethodLabel,
  isInstallmentEligible,
  formatCurrencyInputBRL,
  parseCurrencyInputToFloat
};
