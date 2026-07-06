import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { getApiKey, setApiKey, getSettings, setSettings, getEnabled, setEnabled } from '../services/storage';
import type { ExtensionSettings } from '../services/storage';
import { LANGUAGE_OPTIONS, extractTextFromImage } from '@reading-assist/shared';
import type { Language } from '@reading-assist/shared';
import './popup.css';

function Popup() {
  const [apiKey, setApiKeyState] = useState('');
  const [settings, setSettingsState] = useState<ExtensionSettings>({ sourceLang: 'zh-CN', targetLang: 'en' });
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabledState] = useState(true);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState<Language | 'auto'>('auto');
  const [activeTab, setActiveTab] = useState<'settings' | 'ocr'>('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getApiKey().then(setApiKeyState);
    getSettings().then(setSettingsState);
    getEnabled().then(setEnabledState);
  }, []);

  const handleSave = useCallback(async () => {
    await setApiKey(apiKey);
    await setSettings(settings);
    await setEnabled(enabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKey, settings, enabled]);

  const handleOcr = useCallback(async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrText('');
    try {
      const result = await extractTextFromImage(ocrFile, ocrLang);
      setOcrText(result.text);
    } catch (err: any) {
      setOcrError(err.message ?? 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  }, [ocrFile, ocrLang]);

  const copyOcrText = useCallback(() => {
    navigator.clipboard.writeText(ocrText);
  }, [ocrText]);

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>📖 Reading Assist</h1>
      </header>

      <nav className="popup-tabs">
        <button
          className={`popup-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙ Settings
        </button>
        <button
          className={`popup-tab ${activeTab === 'ocr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocr')}
        >
          📷 OCR
        </button>
      </nav>

      {activeTab === 'settings' && (
        <div className="popup-section">
          <label className="popup-label">
            DeepSeek API Key
            <input
              type="password"
              className="popup-input"
              value={apiKey}
              onChange={e => setApiKeyState(e.target.value)}
              placeholder="sk-..."
            />
          </label>
          <p className="popup-hint">Your key is stored in browser sync storage and never sent anywhere except DeepSeek.</p>

          <label className="popup-label">
            Source Language
            <select
              className="popup-select"
              value={settings.sourceLang}
              onChange={e => setSettingsState(s => ({ ...s, sourceLang: e.target.value }))}
            >
              {LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} {opt.nativeLabel ? `(${opt.nativeLabel})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="popup-label">
            Target Language
            <select
              className="popup-select"
              value={settings.targetLang}
              onChange={e => setSettingsState(s => ({ ...s, targetLang: e.target.value }))}
            >
              {LANGUAGE_OPTIONS.filter(o => o.code !== 'auto').map(opt => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} {opt.nativeLabel ? `(${opt.nativeLabel})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="popup-label popup-toggle-row">
            <span>Enable Overlay</span>
            <button
              className={`popup-toggle ${enabled ? 'popup-toggle-on' : ''}`}
              onClick={() => setEnabledState(!enabled)}
              type="button"
            >
              <span className="popup-toggle-knob" />
            </button>
          </label>
          <p className="popup-hint">When off, selecting text on webpages won't show the translation panel.</p>

          <button className="popup-btn popup-btn-primary" onClick={handleSave}>
            {saved ? '✅ Saved!' : '💾 Save Settings'}
          </button>
        </div>
      )}

      {activeTab === 'ocr' && (
        <div className="popup-section">
          <p className="popup-hint">
            Upload an image to extract text with OCR. Processing happens entirely in your browser.
          </p>

          <label className="popup-label">
            OCR Language
            <select
              className="popup-select"
              value={ocrLang}
              onChange={e => setOcrLang(e.target.value as Language | 'auto')}
            >
              {LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} {opt.nativeLabel ? `(${opt.nativeLabel})` : ''}
                </option>
              ))}
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                setOcrFile(file);
                setOcrText('');
                setOcrError(null);
              }
            }}
          />

          <div className="popup-ocr-buttons">
            <button
              className="popup-btn popup-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Choose Image
            </button>
            {ocrFile && (
              <button
                className="popup-btn popup-btn-primary"
                onClick={handleOcr}
                disabled={ocrLoading}
              >
                {ocrLoading ? '⏳ Processing...' : '🔍 Extract Text'}
              </button>
            )}
          </div>

          {ocrFile && (
            <p className="popup-ocr-filename">Selected: {ocrFile.name}</p>
          )}

          {ocrError && (
            <div className="popup-ocr-error">⚠ {ocrError}</div>
          )}

          {ocrText && (
            <div className="popup-ocr-result">
              <div className="popup-ocr-result-header">
                <span>Extracted Text:</span>
                <button className="popup-btn-sm" onClick={copyOcrText}>📋 Copy</button>
              </div>
              <textarea
                className="popup-ocr-textarea"
                value={ocrText}
                readOnly
                rows={6}
              />
              <p className="popup-hint">
                Text copied to clipboard. Paste it anywhere or use it with the Reading Assist overlay on any webpage.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(React.createElement(Popup));
