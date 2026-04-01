/**
 * Módulo de importação de extratos bancários (OFX, CSV, PDF)
 * Roadmap: v0.8.x
 *
 * - Suporta múltiplos formatos
 * - Valida e normaliza transações
 * - Integra com o pipeline de transações do domínio
 */

import { Transaction } from '../../../shared/types';

export type ExtractFormat = 'OFX' | 'CSV' | 'PDF';

export interface ImportResult {
  transactions: Transaction[];
  errors: string[];
}

export async function importExtract(file: File, format: ExtractFormat): Promise<ImportResult> {
  switch (format) {
    case 'OFX':
      return importOFX(file);
    case 'CSV':
      return importCSV(file);
    case 'PDF':
      return importPDF(file);
    default:
      return { transactions: [], errors: ['Formato não suportado'] };
  }
}

async function importOFX(file: File): Promise<ImportResult> {
  // TODO: Implementar parser OFX
  return { transactions: [], errors: ['Parser OFX não implementado'] };
}

async function importCSV(file: File): Promise<ImportResult> {
  // TODO: Implementar parser CSV
  return { transactions: [], errors: ['Parser CSV não implementado'] };
}

async function importPDF(file: File): Promise<ImportResult> {
  // TODO: Implementar parser PDF
  return { transactions: [], errors: ['Parser PDF não implementado'] };
}
