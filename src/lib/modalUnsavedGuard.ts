import { useCallback, useEffect, useRef } from 'react';

export const UNSAVED_MODAL_CONFIRM_MESSAGE =
  'Existem dados preenchidos que não foram salvos. Deseja realmente sair sem salvar?';

export interface UseModalUnsavedGuardOptions {
  isOpen: boolean;
  /**
   * Snapshot serializável dos campos do formulário. Quando fornecido, a detecção de alterações
   * compara o snapshot atual com o estado inicial capturado logo após a abertura do modal.
   */
  snapshot?: unknown;
  /**
   * Chave que força a recaptura do estado inicial quando o registro editado muda sem fechar o modal
   * (ex: navegação Anterior/Próximo em ClientModal/SupplierModal).
   */
  resetKey?: unknown;
}

/**
 * Protege modais de cadastro e lançamento contra descarte acidental de alterações ao clicar em "X" ou "CANCELAR".
 */
export function useModalUnsavedGuard({
  isOpen,
  snapshot,
  resetKey,
}: UseModalUnsavedGuardOptions) {
  const initialSnapshotRef = useRef<string | null>(null);
  const latestSnapshotRef = useRef<string>('');
  const dirtyFlagRef = useRef(false);
  const armedRef = useRef(false);

  const hasSnapshot = snapshot !== undefined;
  const serialized = hasSnapshot ? JSON.stringify(snapshot) : '';
  latestSnapshotRef.current = serialized;

  useEffect(() => {
    if (!isOpen) {
      initialSnapshotRef.current = null;
      dirtyFlagRef.current = false;
      armedRef.current = false;
      return;
    }

    dirtyFlagRef.current = false;
    armedRef.current = false;

    const timer = window.setTimeout(() => {
      initialSnapshotRef.current = latestSnapshotRef.current;
      dirtyFlagRef.current = false;
      armedRef.current = true;
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isOpen, resetKey]);

  const markDirty = useCallback(() => {
    if (armedRef.current) {
      dirtyFlagRef.current = true;
    }
  }, []);

  const resetDirty = useCallback(() => {
    initialSnapshotRef.current = latestSnapshotRef.current;
    dirtyFlagRef.current = false;
  }, []);

  const isDirty = useCallback(() => {
    if (!isOpen || !armedRef.current) return false;
    if (hasSnapshot && initialSnapshotRef.current !== null) {
      if (latestSnapshotRef.current !== initialSnapshotRef.current) return true;
    }
    return dirtyFlagRef.current;
  }, [isOpen, hasSnapshot]);

  const confirmClose = useCallback(
    (closeFn: () => void) => {
      if (isDirty()) {
        if (!window.confirm(UNSAVED_MODAL_CONFIRM_MESSAGE)) {
          return;
        }
      }
      closeFn();
    },
    [isDirty]
  );

  const captureProps = {
    onChangeCapture: markDirty,
    onInputCapture: markDirty,
  };

  return {
    isDirty,
    markDirty,
    resetDirty,
    confirmClose,
    captureProps,
  };
}
