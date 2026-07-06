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

export interface Definition {
  meaning: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface Example {
  source: string;
  translation: string;
}

export interface DictionaryEntry {
  word: string;
  phonetic: string;
  partOfSpeech?: string;
  definitions: Definition[];
  examples: Example[];
  frequency?: 'common' | 'rare' | 'formal' | 'informal';
}

export interface TranslationResult {
  sourceLang: Language | 'auto';
  targetLang: Language;
  selectedText: string;
  entries: DictionaryEntry[];
  rawTranslation?: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  detectedLanguage?: Language;
}

export interface TextFormatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
}
