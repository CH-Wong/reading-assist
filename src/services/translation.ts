import type { Language, TranslationResult } from '../types';
import { LANGUAGE_NAMES } from '../utils/languages';

/**
 * Translation & dictionary service using DeepSeek.
 *
 * DeepSeek's API is OpenAI-compatible — same request/response format.
 * Uses deepseek-chat model which excels at structured JSON output.
 *
 * The LLM prompt is designed to return structured dictionary-style results
 * similar to Youdao or Pleco — with multiple definitions, pinyin/phonetic,
 * part of speech, and example sentences.
 */

const SYSTEM_PROMPT = `You are a professional dictionary and translation assistant specializing in East Asian and European languages.

For each word or phrase the user provides, return a JSON object with:
1. A simple translation of the word/phrase
2. Multiple dictionary entries, each containing:
   - The word (in original script)
   - Phonetic pronunciation (pinyin with tone marks for Chinese, IPA or romanization for others)
   - Part of speech (verb, noun, adjective, etc.)
   - An array of definitions with meanings and where applicable synonyms/antonyms
   - Example sentences (2-3) showing common usage, each with a translation
   - Frequency label (common, rare, formal, informal)

IMPORTANT: Always respond with valid JSON only, no markdown formatting, no code blocks.`;

function buildUserPrompt(
  text: string,
  sourceLang: Language | 'auto',
  targetLang: Language
): string {
  const source = sourceLang === 'auto'
    ? 'the source language (auto-detected)'
    : LANGUAGE_NAMES[sourceLang as Language] ?? sourceLang;
  const target = LANGUAGE_NAMES[targetLang] ?? targetLang;

  return `Translate and provide dictionary information for the following word/phrase.

Source language: ${source}
Target language: ${target}

Word/phrase: "${text}"

If the text appears to be in ${target} rather than ${source}, just provide a brief translation note and return an empty entries array.

Return JSON in this format:
{
  "sourceLang": "${sourceLang}",
  "targetLang": "${targetLang}",
  "selectedText": "${text}",
  "rawTranslation": "brief translation string",
  "entries": [
    {
      "word": "the word in original script",
      "phonetic": "pinyin or IPA pronunciation",
      "partOfSpeech": "verb/noun/etc.",
      "definitions": [
        { "meaning": "definition", "synonyms": ["syn1"], "antonyms": ["ant1"] }
      ],
      "examples": [
        { "source": "example in source language", "translation": "translation" }
      ],
      "frequency": "common|rare|formal|informal"
    }
  ]
}`;
}

/**
 * Call the DeepSeek API to get dictionary-style translation results.
 * DeepSeek's chat API is fully OpenAI-compatible.
 *
 * Requests go through the Vite dev server proxy (/api/deepseek/*)
 * to avoid CORS restrictions — the browser talks to the same origin.
 *
 * @param apiKey - Your DeepSeek API key
 * @param text - The selected/highlighted text
 * @param sourceLang - Source language code (or 'auto')
 * @param targetLang - Target language code
 * @returns Structured translation result
 */
export async function fetchTranslation(
  apiKey: string,
  text: string,
  sourceLang: Language | 'auto',
  targetLang: Language,
  signal?: AbortSignal
): Promise<TranslationResult> {
  if (!text.trim()) {
    return {
      sourceLang,
      targetLang,
      selectedText: text,
      entries: [],
    };
  }

  const response = await fetch('/api/deepseek/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, sourceLang, targetLang) },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Translation API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from translation API');
  }

  // Parse the JSON response — handle possible markdown code block wrapping
  const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const result: TranslationResult = JSON.parse(jsonStr);

  return result;
}

/**
 * Simple translation without dictionary details (for quick lookups).
 */
export async function fetchSimpleTranslation(
  apiKey: string,
  text: string,
  sourceLang: Language | 'auto',
  targetLang: Language
): Promise<string> {
  if (!text.trim()) return '';

  const source = sourceLang === 'auto'
    ? 'the source language (auto-detected)'
    : LANGUAGE_NAMES[sourceLang as Language] ?? sourceLang;
  const target = LANGUAGE_NAMES[targetLang] ?? targetLang;

  const response = await fetch('/api/deepseek/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a translator. Respond with only the translation, no explanation.' },
        { role: 'user', content: `Translate from ${source} to ${target}: "${text}"` },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation API error (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
