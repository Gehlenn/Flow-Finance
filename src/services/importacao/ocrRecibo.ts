/**
 * Módulo de OCR de recibos (notas fiscais, boletos, recibos)
 * Roadmap: v0.8.x
 *
 * - Usa Tesseract.js ou Gemini Vision
 * - Extrai valor, categoria e data
 * - Integra com o pipeline de transações
 */

export interface OcrResult {
  valor?: number;
  categoria?: string;
  data?: string;
  textoCompleto: string;
  erros: string[];
}

export async function processarReciboOCR(imagem: File | Blob): Promise<OcrResult> {
  // TODO: Integrar Tesseract.js ou Gemini Vision
  return {
    textoCompleto: '',
    erros: ['OCR não implementado']
  };
}
