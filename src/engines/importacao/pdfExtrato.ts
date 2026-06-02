// Módulo de parsing de PDF financeiro
// v0.8.x – Flow Finance

import { Transaction, Category, TransactionType } from '../../../types';
import { logWarn } from '../../utils/logger';

export interface PDFExtratoResultado {
  transacoes: Transaction[];
  erros: string[];
}

export interface PDFExtratoOptions {
  arquivo: Buffer;
  categoriaPadrao?: Category;
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function extrairDePDF(options: PDFExtratoOptions): Promise<PDFExtratoResultado> {
  const erros: string[] = [];
  const transacoes: Transaction[] = [];

  try {
    const pdfParseLoaded = await import('pdf-parse');
    const pdfParseFn: (arquivo: Buffer) => Promise<{ text: string }> = (
      (pdfParseLoaded as { default?: (arquivo: Buffer) => Promise<{ text: string }> }).default
      ?? (pdfParseLoaded as unknown as (arquivo: Buffer) => Promise<{ text: string }>)
    );
    const data = await pdfParseFn(options.arquivo);
    const texto = data.text.trim();

    if (!texto) {
      erros.push('Nenhum texto detectado no PDF.');
    } else {
      const linhas = texto
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (const linha of linhas) {
        const valorMatch = linha.match(/(R\$|\b)[ ]?([0-9]+[\.,][0-9]{2})/);
        if (!valorMatch) continue;

        const valor = parseFloat(valorMatch[2].replace(',', '.'));
        if (Number.isNaN(valor) || !valor) continue;

        const descricao = linha.replace(valorMatch[0], '').trim() || 'Transação PDF';
        transacoes.push({
          id: `${Date.now()}-${descricao}`,
          amount: Math.abs(valor),
          type: valor < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
          category: options.categoriaPadrao || Category.PESSOAL,
          description: descricao,
          date: formatLocalDateKey(new Date()),
          source: 'import',
        });
      }

      if (transacoes.length === 0) {
        erros.push('Nenhuma transação detectada no PDF.');
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    logWarn('[PDFExtrato] Failed to process PDF', {
      error,
      fileSize: options.arquivo?.length ?? 0,
    });
    erros.push(`Erro ao processar PDF: ${message}`);
  }

  return { transacoes, erros };
}
