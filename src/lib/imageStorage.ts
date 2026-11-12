import { useEffect, useState } from 'react';

const DB_NAME = 'AgroControlMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'avatars';

export const INDEXEDDB_PREFIX = 'indexeddb://';
export const COMPANY_LOGO_KEY = 'logo_empresa';
export const COMPANY_LOGO_REF = `${INDEXEDDB_PREFIX}${COMPANY_LOGO_KEY}`;
export const MEDIA_UPDATED_EVENT = 'agrocontrol_media_updated';

interface MediaRecord {
  key: string;
  dataUrl: string;
  updatedAt: string;
}

const mediaCache = new Map<string, string>();
const deletedKeys = new Set<string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let migrationExecuted = false;
let preloadPromise: Promise<void> | null = null;

export function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function isIndexedDbRef(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith(INDEXEDDB_PREFIX);
}

export function extractIndexedDbKey(ref: string): string {
  return ref.trim().slice(INDEXEDDB_PREFIX.length).trim();
}

export function getEmployeeAvatarKey(employeeId: string): string {
  return `avatar_${String(employeeId || '').trim()}`;
}

export function getEmployeeAvatarRef(employeeId: string): string {
  return `${INDEXEDDB_PREFIX}${getEmployeeAvatarKey(employeeId)}`;
}

function dispatchMediaUpdated(key?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(MEDIA_UPDATED_EVENT, {
        detail: { key },
      })
    );
  } catch {
    // ignore dispatch failure
  }
}

function openMediaDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Registra imediatamente no cache em memória síncrono e persiste no IndexedDB (AgroControlMediaDB).
 */
export function setMediaMemoryCache(key: string, dataUrl: string): void {
  if (!key || !dataUrl) return;
  deletedKeys.delete(key);
  mediaCache.set(key, dataUrl);
  dispatchMediaUpdated(key);
}

export async function saveMediaToIndexedDB(key: string, dataUrl: string): Promise<boolean> {
  if (!key || !dataUrl || typeof dataUrl !== 'string') return false;
  const cleanKey = key.trim();
  const cleanDataUrl = dataUrl.trim();
  if (!cleanKey || !cleanDataUrl) return false;

  deletedKeys.delete(cleanKey);
  mediaCache.set(cleanKey, cleanDataUrl);
  dispatchMediaUpdated(cleanKey);

  const db = await openMediaDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: MediaRecord = {
        key: cleanKey,
        dataUrl: cleanDataUrl,
        updatedAt: new Date().toISOString(),
      };
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getMediaFromIndexedDB(key: string): Promise<string | undefined> {
  const cleanKey = String(key || '').trim();
  if (!cleanKey || deletedKeys.has(cleanKey)) return undefined;

  const cached = mediaCache.get(cleanKey);
  if (cached) return cached;

  const db = await openMediaDatabase();
  if (!db) return undefined;

  return new Promise<string | undefined>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanKey);

      req.onsuccess = () => {
        const result = req.result as MediaRecord | undefined;
        if (result?.dataUrl && !deletedKeys.has(cleanKey)) {
          mediaCache.set(cleanKey, result.dataUrl);
          dispatchMediaUpdated(cleanKey);
          resolve(result.dataUrl);
        } else {
          resolve(undefined);
        }
      };

      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function deleteMediaFromIndexedDB(key: string): Promise<boolean> {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return false;

  deletedKeys.add(cleanKey);
  mediaCache.delete(cleanKey);
  dispatchMediaUpdated(cleanKey);

  const db = await openMediaDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(cleanKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function saveEmployeeAvatar(employeeId: string, dataUrl: string): Promise<string> {
  const key = getEmployeeAvatarKey(employeeId);
  await saveMediaToIndexedDB(key, dataUrl);
  return getEmployeeAvatarRef(employeeId);
}

export async function deleteEmployeeAvatar(employeeId: string): Promise<void> {
  if (!employeeId) return;
  await deleteMediaFromIndexedDB(getEmployeeAvatarKey(employeeId));
}

export async function saveCompanyLogo(dataUrl: string): Promise<string> {
  await saveMediaToIndexedDB(COMPANY_LOGO_KEY, dataUrl);
  return COMPANY_LOGO_REF;
}

export async function deleteCompanyLogo(): Promise<void> {
  await deleteMediaFromIndexedDB(COMPANY_LOGO_KEY);
}

/**
 * Carrega todas as mídias do IndexedDB para o cache síncrono em memória na inicialização.
 */
export async function preloadAllMediaFromIndexedDB(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const db = await openMediaDatabase();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const items = (req.result || []) as MediaRecord[];
          let loadedAny = false;
          for (const item of items) {
            if (item?.key && item?.dataUrl && !deletedKeys.has(item.key)) {
              if (!mediaCache.has(item.key)) {
                mediaCache.set(item.key, item.dataUrl);
                loadedAny = true;
              }
            }
          }
          if (loadedAny) {
            dispatchMediaUpdated();
          }
          resolve();
        };

        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  })();

  return preloadPromise;
}

/**
 * Resolve de forma síncrona usando o cache em memória.
 * Para referências `indexeddb://...` ainda não carregadas, dispara carregamento assíncrono em segundo plano e retorna `undefined`.
 */
export function getCachedMediaUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (isIndexedDbRef(trimmed)) {
    const key = extractIndexedDbKey(trimmed);
    if (!key || deletedKeys.has(key)) return undefined;
    const cached = mediaCache.get(key);
    if (cached) return cached;
    void getMediaFromIndexedDB(key);
    return undefined;
  }

  return trimmed;
}

/**
 * Resolve uma referência `indexeddb://...` de forma assíncrona (ideal para janelas de impressão).
 */
export async function resolveMediaUrlAsync(rawUrl?: string | null): Promise<string | undefined> {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (isIndexedDbRef(trimmed)) {
    const key = extractIndexedDbKey(trimmed);
    if (!key || deletedKeys.has(key)) return undefined;
    return getMediaFromIndexedDB(key);
  }

  return trimmed;
}

/**
 * Hook React que resolve URLs `indexeddb://...` reativamente (lê imediatamente do cache e atualiza quando o IndexedDB concluir).
 */
export function useResolvedMediaUrl(rawUrl?: string | null): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(() => getCachedMediaUrl(rawUrl));

  useEffect(() => {
    let active = true;
    const syncValue = () => {
      if (!active) return;
      const next = getCachedMediaUrl(rawUrl);
      setResolved(next);
    };

    syncValue();

    if (isIndexedDbRef(rawUrl)) {
      const key = extractIndexedDbKey(String(rawUrl));
      if (key && !mediaCache.has(key) && !deletedKeys.has(key)) {
        void getMediaFromIndexedDB(key).then((dataUrl) => {
          if (active && dataUrl) {
            setResolved(dataUrl);
          }
        });
      }
    }

    const handleMediaEvent = (ev: Event) => {
      const detailKey = (ev as CustomEvent<{ key?: string }>)?.detail?.key;
      if (!detailKey || (isIndexedDbRef(rawUrl) && extractIndexedDbKey(String(rawUrl)) === detailKey)) {
        syncValue();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(MEDIA_UPDATED_EVENT, handleMediaEvent);
    }

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(MEDIA_UPDATED_EVENT, handleMediaEvent);
      }
    };
  }, [rawUrl]);

  return resolved;
}

/**
 * Extrai um objeto compacto de colaborador sem duplicação de Base64 em 4 campos para o localStorage.
 * Qualquer string `data:image/...` encontrada é movida para IndexedDB + cache em memória.
 */
export function compactEmployeeMediaForStorage<T extends Record<string, any>>(emp: T): T {
  if (!emp || typeof emp !== 'object') return emp;
  const rawPhoto = emp.avatar_url || emp.photoUrl || emp.foto_url || emp.foto;
  const id = String(emp.id || '').trim();

  if (typeof rawPhoto === 'string' && rawPhoto.trim()) {
    const trimmed = rawPhoto.trim();
    if (trimmed.startsWith('data:image/') && id && isIndexedDbSupported()) {
      const key = getEmployeeAvatarKey(id);
      const ref = getEmployeeAvatarRef(id);
      setMediaMemoryCache(key, trimmed);
      void saveMediaToIndexedDB(key, trimmed);

      const next: Record<string, any> = {
        ...emp,
        avatar_url: ref,
        has_avatar: true,
      };
      delete next.photoUrl;
      delete next.foto;
      delete next.foto_url;
      return next as T;
    }

    if (isIndexedDbRef(trimmed)) {
      const next: Record<string, any> = {
        ...emp,
        avatar_url: trimmed,
        has_avatar: true,
      };
      delete next.photoUrl;
      delete next.foto;
      delete next.foto_url;
      return next as T;
    }

    const next: Record<string, any> = {
      ...emp,
      avatar_url: trimmed,
    };
    delete next.photoUrl;
    delete next.foto;
    delete next.foto_url;
    return next as T;
  }

  return emp;
}

/**
 * Rotina de inicialização que:
 * 1. Limpa chaves temporárias de cache, rascunhos órfãos e backups obsoletos do localStorage (sem apagar dados reais de negócio).
 * 2. Migra todas as fotos Base64 de funcionários e logotipo da empresa existentes no localStorage para o IndexedDB (`AgroControlMediaDB`),
 *    substituindo por referências leves (`indexeddb://avatar_...` e `indexeddb://logo_empresa`) e eliminando duplicações pesadas.
 */
export function migrateAndCleanLocalStorageMedia(force = false): {
  migratedAvatars: number;
  migratedLogo: boolean;
  removedGarbageKeys: number;
} {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { migratedAvatars: 0, migratedLogo: false, removedGarbageKeys: 0 };
  }
  if (migrationExecuted && !force) {
    return { migratedAvatars: 0, migratedLogo: false, removedGarbageKeys: 0 };
  }
  migrationExecuted = true;

  let migratedAvatars = 0;
  let migratedLogo = false;
  let removedGarbageKeys = 0;

  try {
    // 1. Limpeza segura de lixo temporário, caches antigos e snapshots de backup obsoletos
    // ATENÇÃO: Preserva estritamente todas as chaves reais de negócio (funcionários, financeiro, bancos, frotas, empresa, etc.)
    const garbageExactOrPrefix = [
      'debug_',
      '_temp_',
      'temp_',
      'colaca_silagem_backup_',
      'agrocontrol_backup_cache_',
      'silagem_facil_clean_v1_backup_',
      'silagem_facil_backup_',
      'colaca_silagem_cache_',
      'silagem_facil_cache_',
      'agrocontrol_cache_',
    ];

    const keysToScan: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keysToScan.push(k);
    }

    for (const k of keysToScan) {
      const lower = k.toLowerCase();
      const isGarbage =
        garbageExactOrPrefix.some((prefix) => lower.startsWith(prefix) || lower.includes(prefix)) ||
        lower.endsWith('_temp') ||
        lower.endsWith('_default') ||
        lower.endsWith('_company_default_fazenda') ||
        lower.endsWith('_undefined');

      if (isGarbage) {
        localStorage.removeItem(k);
        removedGarbageKeys++;
      }
    }

    // Só move Base64 para IndexedDB se o navegador suportar IndexedDB
    if (isIndexedDbSupported()) {
      // 2. Migrar avatares de funcionários em todas as chaves de funcionários existentes
      const employeeKeys = new Set<string>([
        'agrocontrol_funcionarios',
        'colaca_silagem_funcionarios',
        'silagem_facil_clean_v1_employees',
      ]);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('agrocontrol_funcionarios_') ||
            k.startsWith('colaca_silagem_funcionarios_'))
        ) {
          employeeKeys.add(k);
        }
      }

      for (const empKey of employeeKeys) {
        const raw = localStorage.getItem(empKey);
        if (!raw) continue;
        // Verifica rapidamente se contém data:image ou campos redundantes de foto antes de reescrever
        if (!raw.includes('data:image/') && !raw.includes('"foto_url"') && !raw.includes('"photoUrl"')) {
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) continue;
          let changed = false;
          const compacted = parsed.map((emp: any) => {
            if (!emp || typeof emp !== 'object') return emp;
            const rawPhoto = emp.avatar_url || emp.photoUrl || emp.foto_url || emp.foto;
            const hadDataImage = typeof rawPhoto === 'string' && rawPhoto.trim().startsWith('data:image/');
            const hadDuplicates =
              emp.photoUrl !== undefined || emp.foto !== undefined || emp.foto_url !== undefined;

            if (hadDataImage || hadDuplicates) {
              changed = true;
              if (hadDataImage) migratedAvatars++;
              return compactEmployeeMediaForStorage(emp);
            }
            return emp;
          });

          if (changed) {
            localStorage.setItem(empKey, JSON.stringify(compacted));
          }
        } catch {
          // ignore corrupted JSON
        }
      }

      // 3. Migrar logotipo da empresa (chaves diretas e objetos de perfil da empresa)
      const directLogoKeys = ['agrocontrol_empresa_logo', 'agrocontrol_logo'];
      for (const lKey of directLogoKeys) {
        const rawLogo = localStorage.getItem(lKey);
        if (rawLogo && rawLogo.trim().startsWith('data:image/')) {
          const trimmedLogo = rawLogo.trim();
          setMediaMemoryCache(COMPANY_LOGO_KEY, trimmedLogo);
          void saveMediaToIndexedDB(COMPANY_LOGO_KEY, trimmedLogo);
          localStorage.setItem(lKey, COMPANY_LOGO_REF);
          migratedLogo = true;
        }
      }

      const companyObjKeys = new Set<string>([
        'dadosEmpresa',
        'agrocontrol_empresa',
        'silagem_facil_clean_v1_company_profile',
        'colaca_company_profile',
      ]);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('agrocontrol_empresa_') || k.startsWith('colaca_company_profile_')) &&
          k !== 'agrocontrol_empresa_logo'
        ) {
          companyObjKeys.add(k);
        }
      }

      for (const cKey of companyObjKeys) {
        const raw = localStorage.getItem(cKey);
        if (!raw || !raw.includes('data:image/')) continue;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
          const rawLogo = parsed.logoUrl || parsed.logo;
          if (typeof rawLogo === 'string' && rawLogo.trim().startsWith('data:image/')) {
            const trimmedLogo = rawLogo.trim();
            setMediaMemoryCache(COMPANY_LOGO_KEY, trimmedLogo);
            void saveMediaToIndexedDB(COMPANY_LOGO_KEY, trimmedLogo);
            parsed.logoUrl = COMPANY_LOGO_REF;
            if ('logo' in parsed) delete parsed.logo;
            localStorage.setItem(cKey, JSON.stringify(parsed));
            migratedLogo = true;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[imageStorage] Aviso na migração/limpeza de mídia local:', err);
  }

  return { migratedAvatars, migratedLogo, removedGarbageKeys };
}
