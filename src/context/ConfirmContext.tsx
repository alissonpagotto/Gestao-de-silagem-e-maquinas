import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfirmModal } from '../components/common/ConfirmModal';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  }>({
    isOpen: false,
    options: { message: '' },
    resolve: () => {},
  });

  const confirm = useCallback((options: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const normalizedOptions: ConfirmOptions =
        typeof options === 'string'
          ? {
              title: 'Confirmar Ação',
              message: options,
              confirmLabel: 'Confirmar',
              cancelLabel: 'Cancelar',
              variant: 'danger',
            }
          : {
              title: options.title || 'Confirmar Exclusão',
              message: options.message,
              confirmLabel: options.confirmLabel || 'Excluir',
              cancelLabel: options.cancelLabel || 'Cancelar',
              variant: options.variant || 'danger',
            };

      setModalState({
        isOpen: true,
        options: normalizedOptions,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    modalState.resolve(true);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    modalState.resolve(false);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.options.title}
        message={modalState.options.message}
        confirmLabel={modalState.options.confirmLabel}
        cancelLabel={modalState.options.cancelLabel}
        variant={modalState.options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
