import type { TranslationResult } from '@reading-assist/shared';

interface TranslationPanelProps {
  result: TranslationResult | null;
  isLoading: boolean;
  error: string | null;
  selectedText: string;
}

export default function TranslationPanel({
  result,
  isLoading,
  error,
  selectedText,
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
