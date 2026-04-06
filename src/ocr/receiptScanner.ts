export interface OCRImageLike {
  text?: () => Promise<string>;
}

type TesseractModule = {
  recognize: (image: unknown, language?: string) => Promise<{ data?: { text?: string } }>;
};

async function loadTesseract(): Promise<TesseractModule | null> {
  try {
    return (await import('tesseract.js')) as unknown as TesseractModule;
  } catch {
    return null;
  }
}

/**
 * OCR scanner com fallback gratuito.
 * 1) Tenta Tesseract.js (se disponível em runtime)
 * 2) Fallback para arquivo textual (útil em testes e ambientes sem wasm)
 */
export async function scanReceiptText(image: OCRImageLike): Promise<string> {
  const tesseract = await loadTesseract();
  if (tesseract) {
    const result = await tesseract.recognize(image, 'por+eng');
    return result.data?.text ?? '';
  }

  {
    if (image.text) {
      return image.text();
    }
    return '';
  }
}
