import React from 'react';
import { Client } from '../../types';
import { ClientModal, ClientModalProps } from '../crm/ClientModal';

export interface QuickClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (client: Client) => void;
  onSuccess?: (client: Client) => void;
  initialName?: string;
  editingClient?: Client | null;
}

/**
 * QuickClientModal Padronizada e Unificada
 * Renderiza o formulário completo oficial ("Novo Produtor Rural / Pecuarista")
 * do módulo CRM com auto-busca de CNPJ/Receita, CEP/ViaCEP, cálculo de Ton/Mês, etc.
 */
export const QuickClientModal: React.FC<QuickClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  initialName = '',
  editingClient = null,
}) => {
  return (
    <ClientModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      onSuccess={onSuccess}
      initialName={initialName}
      editingClient={editingClient}
      zIndexClass="z-[70]"
    />
  );
};

export default QuickClientModal;
