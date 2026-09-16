import { ClientFormSubmission } from '../types';
import { cleanDigits } from './formatters';

const STORAGE_KEY = 'silagemfacil_pending_client_submissions';

export function getClientSubmissions(): ClientFormSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler submissões de clientes:', err);
    return [];
  }
}

export function saveClientSubmission(submission: ClientFormSubmission): void {
  try {
    const existing = getClientSubmissions();
    const updated = [submission, ...existing.filter(item => item.id !== submission.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar submissão:', err);
  }
}

export function markSubmissionImported(id: string): void {
  try {
    const existing = getClientSubmissions();
    const updated = existing.map(item => item.id === id ? { ...item, status: 'importado' as const } : item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao atualizar status da submissão:', err);
  }
}

export function findSubmissionByDocument(doc: string): ClientFormSubmission | undefined {
  const digits = cleanDigits(doc);
  if (!digits || digits.length < 11) return undefined;
  const submissions = getClientSubmissions();
  return submissions.find(item => {
    const itemDigits = cleanDigits(item.cpfCnpj || '');
    return itemDigits === digits;
  });
}
