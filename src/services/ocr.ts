import { createWorker } from 'tesseract.js';
import type { OcrResult } from '../types';
import { OCR_LANGUAGE_MAP } from '../utils/languages';
import type { Language } from '../types';

/**
 * Perform OCR on an image file using Tesseract.js.
 * Runs entirely client-side — no data is sent to a server.
 *
 * In Tesseract.js v5+, the language is passed directly to createWorker().
 *
 * @param imageFile - The image file to process
 * @param sourceLang - The source language (or 'auto' for auto-detect)
 * @returns The extracted text with confidence score
 */
export async function extractTextFromImage(
  imageFile: File,
  sourceLang: Language | 'auto'
): Promise<OcrResult> {
  const langString = sourceLang === 'auto'
    ? 'chi_sim+chi_tra+nld+deu+eng'
    : OCR_LANGUAGE_MAP[sourceLang] ?? sourceLang;

  const worker = await createWorker(langString);

  try {
    const imageData = await fileToDataUrl(imageFile);
    const { data } = await worker.recognize(imageData);

    return {
      text: data.text.trim(),
      confidence: data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

/** Convert a File to a data URL for Tesseract processing */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
