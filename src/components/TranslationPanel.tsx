import type { TranslationResult, PhoneticResult } from '../types';

interface TranslationPanelProps {
  result: TranslationResult | null;
  isLoading: boolean;
  error: string | null;
  selectedText: string;
  phoneticResult: PhoneticResult | null;
  isPhoneticLoading: boolean;
  phoneticError: string | null;
}

export default function TranslationPanel({
  result,
  isLoading,
  error,
  selectedText,
  phoneticResult,
  isPhoneticLoading,
  phoneticError,
}: TranslationPanelProps) {
  if (!selectedText) {
    return (
      <div className="translation-panel translation-panel--empty">
        <div className="empty-state">
          <span className="empty-icon">👆</span>
          <p>Select a word or phrase in the text to see its translation and dictionary information here.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="translation-panel">
        <div className="loading-state">
          <div className="spinner" />
          <p>Looking up translation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="translation-panel">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>Translation error: {error}</p>
        </div>
      </div>
    );
  }

  if (!result || result.entries.length === 0) {
    return (
      <div className="translation-panel">
        <div className="empty-state">
          <p>No dictionary entries found for "{selectedText}".</p>
          {result?.rawTranslation && (
            <p className="simple-translation">{result.rawTranslation}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="translation-panel">
      <div className="translation-header">
        <h2 className="selected-word">{result.selectedText}</h2>
        {result.rawTranslation && (
          <p className="simple-translation">{result.rawTranslation}</p>
        )}
      </div>

      {/* Phonetic transcription section */}
      <PhoneticSection
        phoneticResult={phoneticResult}
        isLoading={isPhoneticLoading}
        error={phoneticError}
        selectedText={selectedText}
      />

      <div className="entries-list">
        {result.entries.map((entry, idx) => (
          <div key={idx} className="dictionary-entry">
            <div className="entry-header">
              <span className="entry-word">{entry.word}</span>
              <span className="entry-phonetic">{entry.phonetic}</span>
              {entry.partOfSpeech && (
                <span className="entry-pos">{entry.partOfSpeech}</span>
              )}
              {entry.frequency && (
                <span className={`entry-frequency frequency--${entry.frequency}`}>
                  {entry.frequency}
                </span>
              )}
            </div>

            <div className="entry-definitions">
              <h4>Definitions</h4>
              <ol>
                {entry.definitions.map((def, dIdx) => (
                  <li key={dIdx} className="definition-item">
                    <p className="definition-meaning">{def.meaning}</p>
                    {def.synonyms && def.synonyms.length > 0 && (
                      <p className="definition-synonyms">
                        <strong>Synonyms:</strong> {def.synonyms.join(', ')}
                      </p>
                    )}
                    {def.antonyms && def.antonyms.length > 0 && (
                      <p className="definition-antonyms">
                        <strong>Antonyms:</strong> {def.antonyms.join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {entry.examples.length > 0 && (
              <div className="entry-examples">
                <h4>Examples</h4>
                <ul>
                  {entry.examples.map((ex, eIdx) => (
                    <li key={eIdx} className="example-item">
                      <p className="example-source">{ex.source}</p>
                      <p className="example-translation">{ex.translation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sub-component for displaying phonetic transcription (Pinyin, IPA, etc.) */
function PhoneticSection({
  phoneticResult,
  isLoading,
  error,
  selectedText,
}: {
  phoneticResult: PhoneticResult | null;
  isLoading: boolean;
  error: string | null;
  selectedText: string;
}) {
  if (isLoading) {
    return (
      <div className="phonetic-section phonetic-section--loading">
        <div className="spinner spinner--small" />
        <span>Generating phonetic transcription...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="phonetic-section phonetic-section--error">
        <span className="error-icon">⚠️</span>
        <span className="phonetic-error-text">{error}</span>
      </div>
    );
  }

  if (!phoneticResult || phoneticResult.readings.length === 0) {
    return null;
  }

  const hasNotes = phoneticResult.sandhiNotes && phoneticResult.sandhiNotes.length > 0;

  return (
    <div className="phonetic-section">
      <div className="phonetic-header">
        <span className="phonetic-system-badge">{phoneticResult.phoneticSystem}</span>
        <span className="phonetic-combined">{phoneticResult.combinedPhonetic}</span>
      </div>

      {/* Character-by-character ruby-style display */}
      <div className="phonetic-ruby-grid">
        {phoneticResult.readings.map((reading, idx) => (
          <div key={idx} className="ruby-char-group" title={reading.note}>
            <span className="ruby-text">{reading.text}</span>
            <span className="ruby-phonetic">{reading.phonetic}</span>
          </div>
        ))}
      </div>

      {/* Sandhi notes */}
      {hasNotes && (
        <div className="sandhi-notes">
          <span className="sandhi-label">🔊 Tone Sandhi:</span>
          <ul>
            {phoneticResult.sandhiNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
