export interface OCRImageLike {
  text?: () => Promise<string>;
}

type TesseractModule = {
  recognize: (image: unknown, language?: string) => Promise<{ data?: { text?: string } }>;
};

async function loadTesseract(): Promise<{ mod: TesseractModule | null; err?: unknown }> {
  try {
    return { mod: (await import('tesseract.js')) as unknown as TesseractModule };
  } catch (err) {
    return { mod: null, err };
  }
}

/**
 * OCR scanner com fallback gratuito.
 * 1) Tenta Tesseract.js (se disponível em runtime)
 * 2) Fallback para arquivo textual (útil em testes e ambientes sem wasm)
 */
export async function scanReceiptText(image: OCRImageLike): Promise<string> {
  const { mod: tesseract, err } = await loadTesseract();
  if (tesseract) {
    const result = await tesseract.recognize(image, 'por+eng');
    return result.data?.text ?? '';
  }

  console.warn('[OCR Scanner] tesseract.js unavailable, using text fallback:', err);
  if (image.text) {
    return image.text();
  }
  return '';
}
