import React, { useState, useEffect, useRef } from 'react';
import type { TranslationResult, Language } from '@reading-assist/shared';
import { fetchTranslation, TranslationError } from '@reading-assist/shared';
import { getApiKey, getSettings, onSettingsChanged, getEnabled, onEnabledChanged } from '../services/storage';
import type { ExtensionSettings } from '../services/storage';

/** Position the floating panel near the user's text selection */
function getSelectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length === 0) return null;
  return rects[0];
}

export default function ContentApp() {
  const [selectedText, setSelectedText] = useState('');
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings>({ sourceLang: 'zh-CN', targetLang: 'en' });
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const panelRef = useRef<HTMLDivElement>(null);

  // Load settings and API key on mount
  useEffect(() => {
    getSettings().then(setSettings);
    getEnabled().then(setEnabled);
    getApiKey().then(key => {
      setApiKey(key);
      if (!key) {
        setError('No API key set. Click the extension icon to configure.');
      }
    });
    const unsubSettings = onSettingsChanged(setSettings);
    const unsubEnabled = onEnabledChanged(setEnabled);
    return () => { unsubSettings(); unsubEnabled(); };
  }, []);

  // Listen for text selection on the page
  useEffect(() => {
    const handleSelection = () => {
      console.debug('[ReadingAssist] selectionchange fired, enabled:', enabled);

      if (!enabled) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';

      console.debug('[ReadingAssist] selected text:', JSON.stringify(text?.slice(0, 50)));

      if (!text || text.length > 200) {
        // Too long — likely not a word lookup
        setSelectedText('');
        setIsVisible(false);
        return;
      }

      setSelectedText(text);
      // Immediately clear old result so user sees loading, not stale data
      setTranslation(null);
      setError(null);

      // Get position
      const rect = getSelectionRect();
      console.debug('[ReadingAssist] selection rect:', rect);
      if (rect) {
        const top = rect.bottom + window.scrollY + 8;
        const left = Math.max(8, rect.left + window.scrollX + rect.width / 2 - 160);
        setPanelPos({ top, left });
      }

      console.debug('[ReadingAssist] setting isVisible=true');
      setIsVisible(true);

      // Debounced API call
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!apiKey) return;

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
          const result = await fetchTranslation(
            'https://api.deepseek.com',
            apiKey, text,
            settings.sourceLang as Language,
            settings.targetLang as Language,
            controller.signal
          );

          if (!controller.signal.aborted) {
            setTranslation(result);
            console.debug('[ReadingAssist] translation result:', result);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          // Duck-type check: bundled code can break instanceof on Error subclasses
          const msg = typeof err?.userMessage === 'string' ? err.userMessage
            : (typeof err?.code === 'string' ? `Translation error (${err.code})`
            : (err instanceof Error ? err.message
            : 'Translation failed'));
          console.debug('[ReadingAssist] translation error:', msg, err);
          setError(msg);
        } finally {
          // Always clear loading — the abortRef check is too fragile
          setIsLoading(false);
        }
      }, 200);  // Debounce: wait 200ms after selection stabilizes
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [apiKey, settings, enabled]);

  // Hide panel when clicking elsewhere
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isVisible || !selectedText) return null;

  return (
    <div
      ref={panelRef}
      className="ra-panel"
      style={{
        position: 'absolute',
        top: panelPos?.top ?? 0,
        left: panelPos?.left ?? 0,
      }}
    >
      {/* Header */}
      <div className="ra-panel-header">
        <span className="ra-selected-text">{selectedText}</span>
        <button className="ra-close-btn" onClick={() => setIsVisible(false)}>×</button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="ra-loading">
          <div className="ra-spinner" />
          <span>Translating...</span>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="ra-error">
          <span>⚠ {error}</span>
        </div>
      )}

      {/* Translation + fallback when entries are empty */}
      {translation && !isLoading && !error && (
        <div className="ra-translation">
          {translation.rawTranslation && (
            <p className="ra-raw-translation">{translation.rawTranslation}</p>
          )}
          {(!translation.entries || translation.entries.length === 0) && !translation.rawTranslation && (
            <p className="ra-no-entries">No dictionary entries available for this selection.</p>
          )}
        </div>
      )}

      {/* Dictionary entries */}
      {translation && translation.entries && translation.entries.length > 0 && (
        <div className="ra-entries">
          {translation.entries.slice(0, 3).map((entry, idx) => (
            <div key={idx} className="ra-entry">
              <div className="ra-entry-head">
                {entry.word && <span className="ra-entry-word">{entry.word}</span>}
                {entry.phonetic && <span className="ra-entry-phonetic">{entry.phonetic}</span>}
                {entry.partOfSpeech && <span className="ra-entry-pos">{entry.partOfSpeech}</span>}
                {entry.frequency && <span className={`ra-freq ra-freq-${entry.frequency}`}>{entry.frequency}</span>}
              </div>
              {entry.definitions && entry.definitions.length > 0 && (
                <ol className="ra-definitions">
                  {entry.definitions.map((d, di) => (
                    <li key={di}>{d.meaning}</li>
                  ))}
                </ol>
              )}
              {entry.examples && entry.examples.length > 0 && (
                <div className="ra-examples">
                  {entry.examples.slice(0, 2).map((ex, ei) => (
                    <div key={ei} className="ra-example">
                      <p className="ra-ex-source">{ex.source}</p>
                      <p className="ra-ex-translation">{ex.translation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

