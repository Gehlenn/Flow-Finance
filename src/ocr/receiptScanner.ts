import { logWarn } from '../utils/logger';

type TesseractModule = typeof import('tesseract.js');
type TesseractImageLike = Parameters<TesseractModule['recognize']>[0];

export interface OCRTextFallback {
  text(): Promise<string>;
}

export type OCRImageLike = TesseractImageLike | OCRTextFallback;

function isTextFallback(image: OCRImageLike): image is OCRTextFallback {
  if (
    typeof image !== 'object'
    || image === null
    || !('text' in image)
    || typeof image.text !== 'function'
  ) {
    return false;
  }

  return typeof Blob === 'undefined' || !(image instanceof Blob);
}

async function loadTesseract(): Promise<{ mod: TesseractModule | null; err?: unknown }> {
  try {
    return { mod: await import('tesseract.js') };
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
  if (tesseract && !isTextFallback(image)) {
    const result = await tesseract.recognize(image, 'por+eng');
    return result.data?.text ?? '';
  }

  if (!tesseract) {
    logWarn('[OCR Scanner] tesseract.js unavailable, using text fallback', {
      error: err,
      fallback: 'ocr-tesseract-unavailable',
    });
  }
  if (isTextFallback(image)) {
    return image.text();
  }
  return '';
}
