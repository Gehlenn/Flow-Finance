import { Transaction, Category, TransactionType } from '../../../types';
import Tesseract from 'tesseract.js';

export interface OCRReciboResultado {
  transacoes: Transaction[];
  erros: string[];
}

export interface OCRReciboOptions {
  arquivo: Buffer | string;
  categoriaPadrao?: Category;
}

function isValidBase64ImageDataUri(value: string): boolean {
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    return false;
  }

  const normalized = match[1].replace(/\s+/g, '');
  if (normalized.length < 16 || normalized.length % 4 !== 0) {
    return false;
  }

  try {
    const decoded = Buffer.from(normalized, 'base64');
    if (decoded.length < 8) {
      return false;
    }

    const isPng =
      decoded[0] === 0x89 &&
      decoded[1] === 0x50 &&
      decoded[2] === 0x4e &&
      decoded[3] === 0x47 &&
      decoded[4] === 0x0d &&
      decoded[5] === 0x0a &&
      decoded[6] === 0x1a &&
      decoded[7] === 0x0a;
    const isJpeg = decoded[0] === 0xff && decoded[1] === 0xd8 && decoded[decoded.length - 2] === 0xff && decoded[decoded.length - 1] === 0xd9;
    const gifHeader = decoded.subarray(0, 6).toString('ascii');
    const isGif = decoded.length >= 6 && (gifHeader === 'GIF87a' || gifHeader === 'GIF89a');

    return isPng || isJpeg || isGif;
  } catch {
    return false;
  }
}

/**
 * Realiza OCR em recibo, nota ou boleto e extrai transacoes.
 */
export async function ocrRecibo(options: OCRReciboOptions): Promise<OCRReciboResultado> {
  const erros: string[] = [];
  const transacoes: Transaction[] = [];

  try {
    let imageData: string;

    if (Buffer.isBuffer(options.arquivo)) {
      imageData = `data:image/png;base64,${options.arquivo.toString('base64')}`;
    } else if (typeof options.arquivo === 'string' && options.arquivo.startsWith('data:image')) {
      if (!isValidBase64ImageDataUri(options.arquivo)) {
        throw new Error('Imagem base64 invalida para OCR');
      }
      imageData = options.arquivo;
    } else {
      throw new Error('Formato de arquivo nao suportado para OCR');
    }

    const result = await Tesseract.recognize(imageData, 'por');
    const texto = result.data.text.trim();

    if (!texto) {
      erros.push('Nenhum texto detectado no recibo.');
      return { transacoes, erros };
    }

    const valorMatch = texto.match(/(R\$|\b)[ ]?([0-9]+[\.,][0-9]{2})/);
    const valor = valorMatch ? parseFloat(valorMatch[2].replace(',', '.')) : undefined;
    const descricao = texto.split('\n')[0].slice(0, 40) || 'Recibo importado';

    if (valor === undefined) {
      erros.push('Valor nao detectado no texto extraido.');
      return { transacoes, erros };
    }

    transacoes.push({
      id: `${Date.now()}-${descricao}`,
      amount: Math.abs(valor),
      type: valor < 0 ? TransactionType.DESPESA : TransactionType.RECEITA,
      category: options.categoriaPadrao || Category.PESSOAL,
      description: descricao,
      date: new Date().toISOString().slice(0, 10),
      source: 'import',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    erros.push(`Erro no OCR: ${message}`);
  }

  return { transacoes, erros };
}
