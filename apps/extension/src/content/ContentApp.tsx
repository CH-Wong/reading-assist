import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TranslationResult, Language } from '@reading-assist/shared';
import { fetchTranslation, TranslationError } from '@reading-assist/shared';
import { getApiKey, getSettings, onSettingsChanged, getEnabled, onEnabledChanged } from '../services/storage';
import type { ExtensionSettings } from '../services/storage';

/** Position the floating panel near the user's text selection (viewport-relative) */
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

  // Cache the last meaningful selected text so the header still shows it
  // during drag (when the browser clears the real selection on mousedown).
  const displayTextRef = useRef('');

  // Drag state — persists across selections within the same page session, resets on page refresh
  const dragState = useRef<{
    isDragging: boolean;
    startMouseX: number;
    startMouseY: number;
    startPanelLeft: number;
    startPanelTop: number;
    userSetPos: { top: number; left: number } | null;
  }>({
    isDragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startPanelLeft: 0,
    startPanelTop: 0,
    userSetPos: null,
  });

  // Start dragging the panel
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't initiate drag on the close button
    if ((e.target as HTMLElement).closest('.ra-close-btn')) return;

    // Prevent the browser from starting a text-selection drag inside the panel
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragState.current.isDragging = true;
    dragState.current.startMouseX = e.clientX;
    dragState.current.startMouseY = e.clientY;
    dragState.current.startPanelLeft = rect.left;
    dragState.current.startPanelTop = rect.top;
  }, []);

  // Handle mouse move and mouse up for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const dx = e.clientX - dragState.current.startMouseX;
      const dy = e.clientY - dragState.current.startMouseY;
      const newLeft = dragState.current.startPanelLeft + dx;
      const newTop = dragState.current.startPanelTop + dy;

      // Clamp to viewport so the panel can't go completely off-screen
      const clampedLeft = Math.max(-200, Math.min(newLeft, window.innerWidth - 40));
      const clampedTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));

      const newPos = { top: clampedTop, left: clampedLeft };
      dragState.current.userSetPos = newPos;
      setPanelPos(newPos);
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
        // Text cleared or too long. Don't hide the panel — the browser
        // clears the selection on any mousedown (e.g. when the user clicks
        // the panel header to drag it). Hiding is handled by outside-click
        // and the close button instead.
        setSelectedText('');
        return;
      }

      // Fresh selection — update text, clear old result
      setSelectedText(text);
      displayTextRef.current = text;
      setTranslation(null);
      setError(null);

      // Get position — use user-dragged position if set, otherwise compute from selection
      if (dragState.current.userSetPos) {
        setPanelPos(dragState.current.userSetPos);
      } else {
        const rect = getSelectionRect();
        console.debug('[ReadingAssist] selection rect:', rect);
        if (rect) {
          // Viewport-relative (fixed positioning) — no scroll offsets
          const top = rect.bottom + 8;
          const left = Math.max(8, rect.left + rect.width / 2 - 160);
          setPanelPos({ top, left });
        }
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
      // Use composedPath() because clicks inside Shadow DOM are retargeted
      // to the host element; composedPath() reveals the real target path.
      const path = e.composedPath();
      if (panelRef.current && !path.includes(panelRef.current)) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Use cached text for display when the browser has cleared the real selection
  // (e.g. during a drag of the panel header).
  const displayText = selectedText || displayTextRef.current;

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      className="ra-panel"
      style={{
        position: 'fixed',
        top: panelPos?.top ?? 0,
        left: panelPos?.left ?? 0,
      }}
    >
      {/* Header — draggable */}
      <div
        className="ra-panel-header"
        onMouseDown={onHeaderMouseDown}
      >
        <span className="ra-selected-text">{displayText}</span>
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

