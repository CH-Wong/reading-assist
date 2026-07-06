import type { Language, LanguageOption } from './types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect', nativeLabel: '自动检测' },
  { code: 'zh-CN', label: 'Mandarin Chinese', nativeLabel: '简体中文' },
  { code: 'zh-HK', label: 'Cantonese', nativeLabel: '粵語' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
];

export const OCR_LANGUAGE_MAP: Record<string, string> = {
  'zh-CN': 'chi_sim',
  'zh-HK': 'chi_tra',
  'nl': 'nld',
  'de': 'deu',
  'en': 'eng',
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  'zh-CN': 'Mandarin Chinese (Simplified)',
  'zh-HK': 'Cantonese',
  'nl': 'Dutch',
  'de': 'German',
  'en': 'English',
};

export function getLanguageLabel(code: Language | 'auto'): string {
  const option = LANGUAGE_OPTIONS.find(o => o.code === code);
  return option?.label ?? code;
}

export function isCJKLanguage(lang: Language | 'auto'): boolean {
  return lang === 'zh-CN' || lang === 'zh-HK';
}
