// Módulo de Importação de Extratos Bancários (OFX/CSV/PDF)
// v0.8.x – Flow Finance

import { Transaction, TransactionType, Category } from '../../../types';

export type ExtratoFormato = 'OFX' | 'CSV' | 'PDF';

export interface ImportacaoExtratoResultado {
  transacoes: Transaction[];
  erros: string[];
  formatoDetectado: ExtratoFormato;
}

export interface ImportacaoExtratoOptions {
  arquivo: Buffer | string;
  formato?: ExtratoFormato; // Se não informado, tentar auto-detectar
}

/**
 * Importa extrato bancário em formato OFX, CSV ou PDF.
 * @param options Opções de importação
 * @returns Resultado da importação (transações extraídas, erros, formato detectado)
 */
export async function importarExtrato(options: ImportacaoExtratoOptions): Promise<ImportacaoExtratoResultado> {
  let formato: ExtratoFormato | undefined = options.formato;
  let erros: string[] = [];
  let transacoes: Transaction[] = [];
  let conteudo = typeof options.arquivo === 'string' ? options.arquivo : options.arquivo.toString('utf-8');

  // Auto-detecção simples
  if (!formato) {
    if (conteudo.trim().startsWith('<OFX')) formato = 'OFX';
    else if (conteudo.includes(',')) formato = 'CSV';
    else formato = 'PDF';
  }

  if (formato === 'CSV') {
    try {
      // Espera cabeçalho: Data,Descricao,Valor
      const linhas = conteudo.split(/\r?\n/).filter(Boolean);
      const cabecalho = linhas[0].split(',').map(h => h.trim().toLowerCase());
      const idxData = cabecalho.indexOf('data');
      const idxDesc = cabecalho.indexOf('descricao');
      const idxValor = cabecalho.indexOf('valor');
      if (idxData === -1 || idxDesc === -1 || idxValor === -1) {
        erros.push('Cabeçalho CSV inválido. Esperado: Data,Descricao,Valor');
      } else {
        for (let i = 1; i < linhas.length; i++) {
          const cols = linhas[i].split(',');
          if (cols.length < 3) continue;
          const data = cols[idxData].trim();
          const descricao = cols[idxDesc].trim();
          const valor = parseFloat(cols[idxValor].replace(',', '.'));
          if (!data || !descricao || isNaN(valor)) {
            erros.push(`Linha ${i + 1} inválida: ${linhas[i]}`);
            continue;
          }
          transacoes.push({
            id: `${data}-${descricao}-${valor}`,
            amount: Math.abs(valor),
            type: valor < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
            category: Category.PESSOAL,
            description: descricao,
            date: data,
            source: 'import',
          });
        }
      }
    } catch (e: any) {
      erros.push('Erro ao processar CSV: ' + e.message);
    }

  } else if (formato === 'OFX') {
    try {
      // Parsing OFX simplificado: busca por <STMTTRN>...</STMTTRN>
      const transacoesOFX = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
      for (const bloco of transacoesOFX) {
        const getTag = (tag: string) => {
          const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]+)`));
          return m ? m[1].trim() : '';
        };
        const data = getTag('DTPOSTED').slice(0,8); // AAAAMMDD
        const valor = parseFloat(getTag('TRNAMT').replace(',', '.'));
        const descricao = getTag('MEMO') || getTag('NAME') || 'Sem descrição';
        if (!data || isNaN(valor)) {
          erros.push('Transação OFX inválida: ' + bloco);
          continue;
        }
        // Converte data AAAAMMDD para AAAA-MM-DD
        const dataFmt = data.length === 8 ? `${data.slice(0,4)}-${data.slice(4,6)}-${data.slice(6,8)}` : data;
        transacoes.push({
          id: `${dataFmt}-${descricao}-${valor}`,
          amount: Math.abs(valor),
          type: valor < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
          category: Category.PESSOAL,
          description: descricao,
          date: dataFmt,
          source: 'import',
        });
      }
      if (transacoesOFX.length === 0) {
        erros.push('Nenhuma transação encontrada no OFX.');
      }
    } catch (e: any) {
      erros.push('Erro ao processar OFX: ' + e.message);
    }
  } else {
    erros.push('Formato não suportado nesta versão: ' + formato);
  }

  return {
    transacoes,
    erros,
    formatoDetectado: formato,
  };
}
