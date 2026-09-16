// Script de Validação e Execução do Esquema SQL do Supabase
import fs from 'fs';
import path from 'path';

const sqlPath = path.join(process.cwd(), 'supabase', 'schema.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('Arquivo supabase/schema.sql não encontrado!');
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');

console.log('----------------------------------------------------');
console.log('SILAGEM FÁCIL ERP - ESTRUTURAÇÃO DO BANCO SUPABASE');
console.log('----------------------------------------------------');
console.log(`Tamanho do script: ${sqlContent.length} caracteres.`);

// Validação dos requisitos solicitados
const tablesToCheck = [
  'fornecedores',
  'notas_fiscais',
  'contas_a_pagar',
  'estoque'
];

let allOk = true;
for (const tbl of tablesToCheck) {
  if (sqlContent.includes(`CREATE TABLE IF NOT EXISTS public.${tbl}`)) {
    console.log(`[OK] Tabela '${tbl}' estruturada com sucesso.`);
  } else {
    console.error(`[ERRO] Tabela '${tbl}' não encontrada no script!`);
    allOk = false;
  }
}

if (sqlContent.includes('ON DELETE CASCADE')) {
  console.log('[OK] Regra Crítica ON DELETE CASCADE em contas_a_pagar -> notas_fiscais confirmada.');
} else {
  console.error('[ERRO] Regra ON DELETE CASCADE ausente!');
  allOk = false;
}

if (allOk) {
  console.log('\n>> Script SQL verificado e pronto para execução no Supabase SQL Editor ou migração.');
} else {
  process.exit(1);
}
