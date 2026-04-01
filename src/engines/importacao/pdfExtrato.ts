// Módulo de parsing de PDF financeiro
// v0.8.x – Flow Finance

import { Transaction, Category, TransactionType } from '../../../types';
import * as pdfParse from 'pdf-parse';

export interface PDFExtratoResultado {
  transacoes: Transaction[];
  erros: string[];
}

export interface PDFExtratoOptions {
  arquivo: Buffer; // PDF em buffer
  categoriaPadrao?: Category;
}

/**
 * Extrai transações de um PDF financeiro (extrato, recibo, boleto).
 * @param options Opções de extração
 * @returns Transações extraídas e erros
 */
export async function extrairDePDF(options: PDFExtratoOptions): Promise<PDFExtratoResultado> {
  let erros: string[] = [];
  let transacoes: Transaction[] = [];
  try {
    const data = await (pdfParse as any)(options.arquivo);
    const texto = data.text.trim();
    if (!texto) {
      erros.push('Nenhum texto detectado no PDF.');
    } else {
      // Extração simplificada: busca linhas com valor e descrição
      const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        const valorMatch = linha.match(/(R\$|\b)[ ]?([0-9]+[\.,][0-9]{2})/);
        const valor = valorMatch ? parseFloat(valorMatch[2].replace(',', '.')) : undefined;
        if (valor) {
          const descricao = linha.replace(valorMatch[0], '').trim() || 'Transação PDF';
          transacoes.push({
            id: `${Date.now()}-${descricao}`,
            amount: Math.abs(valor),
            type: valor < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
            category: options.categoriaPadrao || Category.PESSOAL,
            description: descricao,
            date: new Date().toISOString().slice(0, 10),
            source: 'import',
          });
        }
      }
      if (transacoes.length === 0) {
        erros.push('Nenhuma transação detectada no PDF.');
      }
    }
  } catch (e: any) {
    erros.push('Erro ao processar PDF: ' + e.message);
  }
  return { transacoes, erros };
}
