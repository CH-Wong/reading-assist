import type { Language } from '../types';
import { LANGUAGE_NAMES } from '../utils/languages';

/**
 * Phonetic transcription service using DeepSeek LLM.
 *
 * This service uses an LLM (DeepSeek) to generate accurate phonetic
 * transcriptions for text in various languages. For Chinese, it produces
 * Pinyin with tone marks that correctly reflect tone sandhi (变调) based
 * on the surrounding context. For other languages, it produces IPA or an
 * appropriate romanization system.
 *
 * The key insight is that tone sandhi rules depend on the full sentence
 * context — the LLM sees the entire sentence to determine the correct
 * surface tones for each character.
 */

/** A single character or word with its phonetic reading */
export interface CharReading {
  text: string;        // The original character(s)
  phonetic: string;    // Phonetic reading (Pinyin, IPA, etc.)
  note?: string;       // Optional note about sandhi or irregular reading
}

/** Full phonetic result for a piece of text */
export interface PhoneticResult {
  sourceText: string;          // The original text
  sourceLang: Language | 'auto';
  phoneticSystem: string;      // e.g. "Pinyin", "Jyutping", "IPA"
  readings: CharReading[];     // Character-by-character readings
  combinedPhonetic: string;    // Full phonetic string (e.g. "nǐ hǎo")
  sandhiNotes: string[];       // Explanation of sandhi changes applied
}

/** Which phonetic system to use for each language */
const PHONETIC_SYSTEMS: Record<string, string> = {
  'zh-CN': 'Hanyu Pinyin with tone marks (ā á ǎ à). Apply tone sandhi rules: 3rd+3rd→2nd+3rd, 一 yī sandhi, 不 bù sandhi, and any other context-dependent tone changes.',
  'zh-HK': 'Jyutping romanization with tone numbers (1-6). Apply any tone sandhi that is standard in spoken Cantonese.',
  'nl': 'IPA (International Phonetic Alphabet) with stress marks.',
  'de': 'IPA (International Phonetic Alphabet) with stress marks.',
  'en': 'IPA (International Phonetic Alphabet) with stress marks.',
};

const SYSTEM_PROMPT = `You are an expert phonetician and linguist specializing in phonetic transcription across multiple languages.

Your task is to produce accurate phonetic readings for text, paying special attention to:
- Chinese tone sandhi (变调): third-tone sandhi, 一/不 tone changes, and other context-dependent tone shifts
- Character-by-character accuracy: each character must be paired with its correct reading
- Proper stress marking for European languages
- Irregular readings and polyphonic characters (多音字)

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no code blocks.
- For Chinese, the phonetic field MUST use tone-mark diacritics (ā á ǎ à), NOT tone numbers.
- For each character, provide its reading in the specified phonetic system.
- Note any sandhi changes or irregular readings in the "note" field.`;

function buildUserPrompt(
  text: string,
  surroundingContext: string,
  lang: Language | 'auto'
): string {
  const langName = lang === 'auto'
    ? 'the language (auto-detected from context)'
    : LANGUAGE_NAMES[lang as Language] ?? lang;
  const phoneticSystem = (lang !== 'auto' && PHONETIC_SYSTEMS[lang])
    ? PHONETIC_SYSTEMS[lang]
    : 'the most appropriate phonetic/romanization system for this language';

  const contextSection = surroundingContext
    ? `\nSurrounding context (for tone sandhi analysis): "${surroundingContext}"`
    : '';

  return `Provide phonetic transcription for the following text.

Source language: ${langName}
Phonetic system to use: ${phoneticSystem}

Selected text to transcribe: "${text}"${contextSection}

Important instructions:
- Break the text down character by character (for CJK languages) or word by word (for others).
- For Chinese, apply tone sandhi rules based on the surrounding context. Note which sandhi changes were applied.
- For polyphonic characters (多音字 like 了, 得, 着, 长), choose the correct reading based on context.
- The "combinedPhonetic" field should be a space-separated string of all phonetic readings.

Return JSON in this exact format:
{
  "sourceText": "the original text",
  "sourceLang": "${lang}",
  "phoneticSystem": "name of the system used",
  "readings": [
    { "text": "单", "phonetic": "phonetic reading", "note": "optional note" }
  ],
  "combinedPhonetic": "full phonetic string",
  "sandhiNotes": ["explanation of sandhi applied"]
}`;
}

/**
 * Fetch phonetic transcription for selected text using the LLM.
 *
 * @param apiKey - DeepSeek API key
 * @param text - The selected/highlighted text
 * @param surroundingContext - The full sentence or phrase containing the text (for sandhi)
 * @param sourceLang - Source language code
 * @param signal - AbortSignal for cancellation
 */
export async function fetchPhonetic(
  apiKey: string,
  text: string,
  surroundingContext: string,
  sourceLang: Language | 'auto',
  signal?: AbortSignal
): Promise<PhoneticResult> {
  if (!text.trim()) {
    return {
      sourceText: text,
      sourceLang,
      phoneticSystem: '',
      readings: [],
      combinedPhonetic: '',
      sandhiNotes: [],
    };
  }

  const response = await fetch('/api/deepseek/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text, surroundingContext, sourceLang) },
      ],
      temperature: 0.1,    // Low temperature for factual accuracy
      max_tokens: 800,
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Phonetic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from phonetic API');
  }

  // Parse the JSON response — handle possible markdown code block wrapping
  const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const result: PhoneticResult = JSON.parse(jsonStr);

  return result;
}

/**
 * Get the full sentence/text surrounding a selection from the editor content.
 * Strips HTML tags and returns plain text context.
 */
export function extractSurroundingContext(
  editorHtml: string,
  selectionStart: number,
  selectionEnd: number
): { sentence: string; fullContext: string } {
  // Strip HTML tags to get plain text
  const plainText = editorHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Find the sentence boundaries around the selection
  // For CJK text, sentence boundaries are: 。！？.!?\n and also ， for clause context
  // We try to get the enclosing sentence first, then fall back to surrounding paragraph
  const before = plainText.substring(0, selectionStart);
  const after = plainText.substring(selectionEnd);

  // Find sentence start: look for sentence-ending punctuation before the selection
  const sentenceDelimiters = /[。！？.!?\n]/g;
  let sentenceStart = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceDelimiters.exec(before)) !== null) {
    sentenceStart = match.index + 1;
  }

  // Find sentence end: look for sentence-ending punctuation after the selection
  const afterMatch = sentenceDelimiters.exec(after);
  const sentenceEnd = afterMatch
    ? selectionEnd + afterMatch.index + 1
    : plainText.length;

  const sentence = plainText.substring(sentenceStart, sentenceEnd).trim();

  // Also provide a wider context (up to 200 chars) for the LLM
  const contextStart = Math.max(0, selectionStart - 100);
  const contextEnd = Math.min(plainText.length, selectionEnd + 100);
  const fullContext = plainText.substring(contextStart, contextEnd).trim();

  return { sentence, fullContext };
}
