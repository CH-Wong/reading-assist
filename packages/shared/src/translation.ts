import type { Language, TranslationResult } from './types';
import { LANGUAGE_NAMES } from './languages';

/**
 * Unified translation service for Reading Assist.
 *
 * Shared between the webapp (uses Vite proxy at /api/deepseek) and the
 * browser extension (calls api.deepseek.com directly).
 *
 * Includes a 3-strategy JSON parser with automatic retry when the LLM
 * returns malformed responses.
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

const STRICT_SYSTEM_PROMPT = `You are a JSON-only translation API. You must respond with valid JSON and nothing else. No markdown, no explanations, no code blocks — only the JSON object starting with { and ending with }.`;

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

function buildRetryPrompt(
  text: string,
  sourceLang: Language | 'auto',
  targetLang: Language
): string {
  const source = sourceLang === 'auto'
    ? 'the source language (auto-detected)'
    : LANGUAGE_NAMES[sourceLang as Language] ?? sourceLang;
  const target = LANGUAGE_NAMES[targetLang] ?? targetLang;

  return `CRITICAL: You MUST respond with ONLY a raw JSON object. Do NOT wrap it in markdown code blocks. Do NOT add any text before or after the JSON. The response must start with "{" and end with "}".

Translate and provide dictionary information for: "${text}"
From ${source} to ${target}.

Required JSON format:
{"sourceLang":"${sourceLang}","targetLang":"${targetLang}","selectedText":"${text}","rawTranslation":"brief translation","entries":[{"word":"...","phonetic":"...","partOfSpeech":"...","definitions":[{"meaning":"...","synonyms":[],"antonyms":[]}],"examples":[{"source":"...","translation":"..."}],"frequency":"common"}]}`;
}

// ── JSON parser with 3 strategies ──

function parseTranslationJson(content: string): TranslationResult | null {
  let cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const result = JSON.parse(cleaned);
    if (isValidResult(result)) return result;
  } catch { /* continue */ }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      if (isValidResult(result)) return result;
    } catch { /* continue */ }

    let fixed = jsonMatch[0]
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    try {
      const result = JSON.parse(fixed);
      if (isValidResult(result)) return result;
    } catch { /* continue */ }
  }

  return null;
}

function isValidResult(obj: any): obj is TranslationResult {
  return obj && typeof obj.selectedText === 'string' && Array.isArray(obj.entries);
}

// ── API call ──

async function callApi(
  apiBaseUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,  // Enough for dictionary entries; reduces latency ~30%
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

  return content;
}

// ── Public API ──

/**
 * Fetch dictionary-style translation with JSON parse retry.
 *
 * @param apiBaseUrl - Base URL for the DeepSeek API
 *   - Webapp: '/api/deepseek' (goes through Vite dev proxy)
 *   - Extension: 'https://api.deepseek.com' (direct call)
 */
export async function fetchTranslation(
  apiBaseUrl: string,
  apiKey: string,
  text: string,
  sourceLang: Language | 'auto',
  targetLang: Language,
  signal?: AbortSignal
): Promise<TranslationResult> {
  if (!text.trim()) {
    return { sourceLang, targetLang, selectedText: text, entries: [] };
  }

  let content = await callApi(
    apiBaseUrl, apiKey, SYSTEM_PROMPT,
    buildUserPrompt(text, sourceLang, targetLang),
    signal
  );

  let result = parseTranslationJson(content);

  if (!result) {
    content = await callApi(
      apiBaseUrl, apiKey, STRICT_SYSTEM_PROMPT,
      buildRetryPrompt(text, sourceLang, targetLang),
      signal
    );
    result = parseTranslationJson(content);
  }

  if (!result) {
    throw new Error(
      'Translation service returned an invalid response. Try again or select different text.'
    );
  }

  return result;
}
