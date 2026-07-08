import { useState, useCallback, useRef, useEffect } from 'react';
import type { Language, TranslationResult } from '@reading-assist/shared';
import type { TranslationErrorCode } from '@reading-assist/shared';
import LanguageSelector from './components/LanguageSelector';
import TextEditor from './components/TextEditor';
import TranslationPanel from './components/TranslationPanel';
import ImageUpload from './components/ImageUpload';
import type { OcrStatus } from './components/ImageUpload';

// Retrieve API key from localStorage, or prompt user
function getApiKey(): string {
  const stored = localStorage.getItem('reading-assist-api-key');
  if (stored) return stored;
  const key = prompt(
    'Enter your DeepSeek API key to enable translations.\n' +
    '(It will be stored locally in your browser and never sent anywhere except DeepSeek.)'
  );
  if (key) {
    localStorage.setItem('reading-assist-api-key', key);
    return key;
  }
  return '';
}

export default function App() {
  const [sourceLang, setSourceLang] = useState<Language | 'auto'>('zh-CN');
  const [targetLang, setTargetLang] = useState<Language>('en');
  const handleTargetLangChange = useCallback((lang: Language | 'auto') => {
    if (lang !== 'auto') setTargetLang(lang);
  }, []);
  const [ocrSourceLang, setOcrSourceLang] = useState<Language | 'auto'>('auto');

  const [editorContent, setEditorContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationErrorCode, setTranslationErrorCode] = useState<TranslationErrorCode | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>({ state: 'idle' });

  const apiKeyRef = useRef<string>(getApiKey());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Refs to avoid dependency churn — the selection handler uses these instead of state
  const sourceLangRef = useRef(sourceLang);
  sourceLangRef.current = sourceLang;
  const targetLangRef = useRef(targetLang);
  targetLangRef.current = targetLang;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectionChange = useCallback(
    (text: string, _selection: { start: number; end: number; fullText: string } | null) => {
      const currentSourceLang = sourceLangRef.current;
      const currentTargetLang = targetLangRef.current;

      setSelectedText(text);
      setTranslationResult(null);
      setTranslationError(null);
      setTranslationErrorCode(null);

      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!text.trim() || !apiKeyRef.current) {
        return;
      }

      if (isOfflineRef.current) {
        setTranslationError('You are offline. Please check your internet connection.');
        setTranslationErrorCode('NETWORK');
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        setIsTranslating(true);
        setTranslationError(null);
        setTranslationErrorCode(null);

        try {
          const { fetchTranslation } = await import('@reading-assist/shared');

          const translation = await fetchTranslation(
            '/api/deepseek',
            apiKeyRef.current,
            text,
            currentSourceLang,
            currentTargetLang,
            controller.signal
          );

          if (!controller.signal.aborted) {
            setTranslationResult(translation);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return;
          }

          // Duck-type: bundled code can break instanceof on Error subclasses
          const msg = typeof err?.userMessage === 'string' ? err.userMessage
            : (typeof err?.code === 'string' ? `Translation error (${err.code})`
            : (err instanceof Error ? err.message
            : 'Translation failed'));
          console.debug('[ReadingAssist] translation error:', msg, err);
          setTranslationError(msg);
          setTranslationErrorCode(typeof err?.code === 'string' ? err.code : null);
          setTranslationResult(null);
        } finally {
          // Always clear loading
          setIsTranslating(false);
        }
      }, 400);
    },
    [] // stable — reads latest lang values from refs
  );

  const handleOcrText = useCallback((text: string) => {
    // Append OCR text to the editor, preceded by a separator
    const separator = editorContent ? '<hr/><p><em>[OCR extracted text]</em></p>' : '';
    const newContent = (editorContent ? editorContent + separator : '') + `<p>${escapeHtml(text)}</p>`;
    setEditorContent(newContent);
  }, [editorContent]);

  const handleOcrStatusChange = useCallback((status: OcrStatus) => {
    setOcrStatus(status);
  }, []);

  const handleApiKeyChange = () => {
    const key = prompt('Enter your DeepSeek API key:');
    if (key) {
      localStorage.setItem('reading-assist-api-key', key);
      apiKeyRef.current = key;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1 className="app-title">📖 Reading Assist</h1>
          <button className="api-key-btn" onClick={handleApiKeyChange} title="Change API key">
            🔑 API Key
          </button>
        </div>

        <div className="language-bar">
          <LanguageSelector
            label="Source"
            value={sourceLang}
            onChange={setSourceLang}
          />
          <span className="lang-arrow">→</span>
          <LanguageSelector
            label="Target"
            value={targetLang}
            onChange={handleTargetLangChange}
          />
        </div>
      </header>

      <main className="app-main">
        <section className="editor-section">
          <div className="section-header">
            <h2>
              Text Editor
              {ocrStatus.state === 'success' && (
                <span className="ocr-status ocr-status--success" style={{ marginLeft: 8 }}>
                  <span className="ocr-status-dot" />
                  {ocrStatus.message ?? 'OCR complete'}
                </span>
              )}
              {ocrStatus.state === 'processing' && (
                <span className="ocr-status ocr-status--processing" style={{ marginLeft: 8 }}>
                  <span className="ocr-status-dot" />
                  {ocrStatus.message ?? 'Processing...'}
                </span>
              )}
            </h2>
            <ImageUpload
              onTextExtracted={handleOcrText}
              sourceLang={ocrSourceLang}
              onSourceLangChange={setOcrSourceLang}
              onOcrStatusChange={handleOcrStatusChange}
            />
          </div>
          <TextEditor
            value={editorContent}
            onChange={setEditorContent}
            onSelectionChange={handleSelectionChange}
          />
        </section>

        <aside className="translation-section">
          <div className="section-header">
            <h2>Reading Help</h2>
          </div>
          <TranslationPanel
            result={translationResult}
            isLoading={isTranslating}
            error={translationError}
            errorCode={translationErrorCode}
            selectedText={selectedText}
            isOffline={isOffline}
            onRetry={async () => {
              const controller = new AbortController();
              abortRef.current = controller;
              setIsTranslating(true);
              setTranslationError(null);
              setTranslationErrorCode(null);
              try {
                const { fetchTranslation } = await import('@reading-assist/shared');
                const t = await fetchTranslation('/api/deepseek', apiKeyRef.current, selectedText, sourceLangRef.current, targetLangRef.current, controller.signal);
                if (!controller.signal.aborted) {
                  setTranslationResult(t);
                  setIsTranslating(false);
                }
              } catch (retryErr: any) {
                if (retryErr?.name === 'AbortError') return;
                const msg = typeof retryErr?.userMessage === 'string' ? retryErr.userMessage
                  : (typeof retryErr?.code === 'string' ? `Translation error (${retryErr.code})`
                  : (retryErr instanceof Error ? retryErr.message
                  : 'Translation failed'));
                if (!controller.signal.aborted) {
                  setTranslationError(msg);
                  setTranslationErrorCode(typeof retryErr?.code === 'string' ? retryErr.code : null);
                  setTranslationResult(null);
                  setIsTranslating(false);
                }
              }
            }}
          />
        </aside>
      </main>
    </div>
  );
}

/** Simple HTML entity escaping for pasted OCR text */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, ch => map[ch] ?? ch);
}
