import { createWorker } from 'tesseract.js';
import type { OcrResult, Language } from './types';
import { OCR_LANGUAGE_MAP } from './languages';

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
    return { text: data.text.trim(), confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
