/**
 * Legacy compatibility wrapper for receipt OCR.
 *
 * Canonical flow:
 * - `pages/ReceiptScanner.tsx`
 * - `src/ai/receiptScanner.ts`
 */

import { scanReceipt } from '../../ai/receiptScanner';

export interface OcrResult {
  valor?: number;
  categoria?: string;
  data?: string;
  textoCompleto: string;
  erros: string[];
}

export async function processarReciboOCR(imagem: File | Blob): Promise<OcrResult> {
  const file = imagem instanceof File
    ? imagem
    : new File([imagem], 'receipt-upload.png', { type: imagem.type || 'image/png' });

  const result = await scanReceipt(file);
  if (!result.success || !result.data) {
    return {
      textoCompleto: '',
      erros: [result.error || 'OCR falhou'],
    };
  }

  return {
    valor: result.data.amount ?? undefined,
    categoria: result.data.category ?? undefined,
    data: result.data.date ?? undefined,
    textoCompleto: result.data.raw_text ?? result.data.description ?? '',
    erros: [],
  };
}
