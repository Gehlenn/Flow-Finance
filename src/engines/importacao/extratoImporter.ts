// MÃ³dulo de ImportaÃ§Ã£o de Extratos BancÃ¡rios (OFX/CSV/PDF)
// v0.8.x â€“ Flow Finance

import { Transaction, TransactionType, Category } from '../../../types';
import { logWarn } from '../../utils/logger';

export type ExtratoFormato = 'OFX' | 'CSV' | 'PDF';

export interface ImportacaoExtratoResultado {
  transacoes: Transaction[];
  erros: string[];
  formatoDetectado: ExtratoFormato;
}

export interface ImportacaoExtratoOptions {
  arquivo: Buffer | string;
  formato?: ExtratoFormato; // Se nÃ£o informado, tentar auto-detectar
}

/**
 * Importa extrato bancÃ¡rio em formato OFX, CSV ou PDF.
 * @param options OpÃ§Ãµes de importaÃ§Ã£o
 * @returns Resultado da importaÃ§Ã£o (transaÃ§Ãµes extraÃ­das, erros, formato detectado)
 */
export async function importarExtrato(options: ImportacaoExtratoOptions): Promise<ImportacaoExtratoResultado> {
  let formato: ExtratoFormato | undefined = options.formato;
  let erros: string[] = [];
  let transacoes: Transaction[] = [];
  let conteudo = '';

  try {
    conteudo = typeof options.arquivo === 'string' ? options.arquivo : options.arquivo.toString('utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao ler arquivo de extrato.';
    const format = formato || 'CSV';
    if (format === 'CSV') {
      logWarn('[ExtratoImporter] CSV processing failed', { format, error });
      erros.push('Erro ao processar CSV: ' + message);
    } else if (format === 'OFX') {
      logWarn('[ExtratoImporter] OFX processing failed', { format, error });
      erros.push('Erro ao processar OFX: ' + message);
    } else {
      logWarn('[ExtratoImporter] File reading failed', { format, error });
      erros.push('Erro ao ler arquivo de extrato: ' + message);
    }

    return {
      transacoes,
      erros,
      formatoDetectado: (format as ExtratoFormato),
    };
  }

  // Auto-detecÃ§Ã£o simples
  if (!formato) {
    if (conteudo.trim().startsWith('<OFX')) formato = 'OFX';
    else if (conteudo.includes(',')) formato = 'CSV';
    else formato = 'PDF';
  }

  if (formato === 'CSV') {
    try {
      // Espera cabeÃ§alho: Data,Descricao,Valor
      const linhas = conteudo.split(/\r?\n/).filter(Boolean);
      const cabecalho = linhas[0].split(',').map(h => h.trim().toLowerCase());
      const idxData = cabecalho.indexOf('data');
      const idxDesc = cabecalho.indexOf('descricao');
      const idxValor = cabecalho.indexOf('valor');
      if (idxData === -1 || idxDesc === -1 || idxValor === -1) {
        erros.push('CabeÃ§alho CSV invÃ¡lido. Esperado: Data,Descricao,Valor');
      } else {
        for (let i = 1; i < linhas.length; i++) {
          const cols = linhas[i].split(',');
          if (cols.length < 3) continue;
          const data = cols[idxData].trim();
          const descricao = cols[idxDesc].trim();
          const valor = parseFloat(cols[idxValor].replace(',', '.'));
          if (!data || !descricao || isNaN(valor)) {
            erros.push(`Linha ${i + 1} invÃ¡lida: ${linhas[i]}`);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao processar CSV.';
      logWarn('[ExtratoImporter] CSV processing failed', { format: formato || 'CSV', error });
      erros.push('Erro ao processar CSV: ' + message);
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
        const descricao = getTag('MEMO') || getTag('NAME') || 'Sem descriÃ§Ã£o';
        if (!data || isNaN(valor)) {
          erros.push('TransaÃ§Ã£o OFX invÃ¡lida: ' + bloco);
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
        erros.push('Nenhuma transaÃ§Ã£o encontrada no OFX.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao processar OFX.';
      logWarn('[ExtratoImporter] OFX processing failed', { format: formato || 'OFX', error });
      erros.push('Erro ao processar OFX: ' + message);
    }
  } else {
    erros.push('Formato nÃ£o suportado nesta versÃ£o: ' + formato);
  }

  return {
    transacoes,
    erros,
    formatoDetectado: formato,
  };
}

