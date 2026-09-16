import { SupplierFormSubmission } from '../types';
import { cleanDigits } from './formatters';

const STORAGE_KEY = 'silagemfacil_pending_supplier_submissions';

export function getSupplierSubmissions(): SupplierFormSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler submissões de fornecedores:', err);
    return [];
  }
}

export function saveSupplierSubmission(submission: SupplierFormSubmission): void {
  try {
    const existing = getSupplierSubmissions();
    const updated = [submission, ...existing.filter(item => item.id !== submission.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar submissão de fornecedor:', err);
  }
}

export function markSupplierSubmissionImported(id: string): void {
  try {
    const existing = getSupplierSubmissions();
    const updated = existing.map(item => item.id === id ? { ...item, status: 'importado' as const } : item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao atualizar status da submissão do fornecedor:', err);
  }
}

export function findSupplierSubmissionByDocument(doc: string): SupplierFormSubmission | undefined {
  const digits = cleanDigits(doc);
  if (!digits || (digits.length !== 11 && digits.length !== 14)) return undefined;
  const submissions = getSupplierSubmissions();
  return submissions.find(item => {
    const itemDigits = cleanDigits(item.cnpjOrCpf || '');
    return itemDigits === digits;
  });
}
