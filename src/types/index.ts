/** Supported languages for reading assistance */
export type Language = 
  | 'zh-CN'   // Mandarin Chinese (Simplified)
  | 'zh-HK'   // Cantonese
  | 'nl'      // Dutch
  | 'de'      // German
  | 'en';     // English

export interface LanguageOption {
  code: Language | 'auto';
  label: string;
  nativeLabel: string;
}

/** A single dictionary entry for a word/phrase */
export interface DictionaryEntry {
  word: string;
  phonetic: string;           // Pinyin for Chinese, IPA for others
  partOfSpeech?: string;      // e.g. "verb", "noun", "adjective"
  definitions: Definition[];
  examples: Example[];
  frequency?: 'common' | 'rare' | 'formal' | 'informal';
}

export interface Definition {
  meaning: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface Example {
  source: string;             // The example sentence in source language
  translation: string;        // Translation in target language
}

/** Response from the translation/dictionary service */
export interface TranslationResult {
  sourceLang: Language | 'auto';
  targetLang: Language;
  selectedText: string;
  entries: DictionaryEntry[];
  rawTranslation?: string;    // Simple translation of the selection
}

/** State for the image OCR flow */
export interface OcrResult {
  text: string;
  confidence: number;
  detectedLanguage?: Language;
}

/** Text formatting options for the editor */
export interface TextFormatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
}
