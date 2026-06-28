import { useRef, useState, useEffect } from 'react';
import type { Language } from '../types';
import LanguageSelector from './LanguageSelector';

interface ImageUploadProps {
  onTextExtracted: (text: string) => void;
  sourceLang: Language | 'auto';
  onSourceLangChange: (lang: Language | 'auto') => void;
  onOcrStatusChange?: (status: OcrStatus) => void;
}

export interface OcrStatus {
  state: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  confidence?: number;
}

export default function ImageUpload({
  onTextExtracted,
  sourceLang,
  onSourceLangChange,
  onOcrStatusChange,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  // Auto-dismiss preview after a few seconds once OCR completes
  useEffect(() => {
    if (lastConfidence !== null && !isProcessing) {
      const timer = setTimeout(() => {
        setLastConfidence(null);
        clearPreview();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [lastConfidence, isProcessing]);

  const clearPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  };

  const updateOcrStatus = (status: OcrStatus) => {
    onOcrStatusChange?.(status);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    updateOcrStatus({ state: 'processing', message: 'Running OCR...' });

    // Clear previous preview if any
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    // Show preview
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setPreview(previewUrl);

    try {
      // Dynamically import the OCR service
      const { extractTextFromImage } = await import('../services/ocr');
      const result = await extractTextFromImage(file, sourceLang);

      if (result.text) {
        onTextExtracted(result.text);
        setLastConfidence(result.confidence);
        updateOcrStatus({
          state: 'success',
          message: `Text extracted (${Math.round(result.confidence)}% confidence)`,
          confidence: result.confidence,
        });
      } else {
        const msg = 'No text could be extracted from this image. Try a clearer image.';
        setError(msg);
        updateOcrStatus({ state: 'error', message: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR processing failed';
      setError(msg);
      updateOcrStatus({ state: 'error', message: msg });
    } finally {
      setIsProcessing(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const statusClass = isProcessing
    ? 'ocr-status ocr-status--processing'
    : lastConfidence !== null
      ? 'ocr-status ocr-status--success'
      : error
        ? 'ocr-status ocr-status--error'
        : null;

  return (
    <div className="image-upload">
      <div className="image-upload-controls">
        <LanguageSelector
          label="OCR Language"
          value={sourceLang}
          onChange={onSourceLangChange}
          includeAuto
        />
        <button
          className="upload-btn"
          onClick={handleClick}
          disabled={isProcessing}
          title="Upload an image to extract text via OCR"
        >
          {isProcessing ? (
            <>
              <span className="spinner spinner--small" />
              OCR Processing...
            </>
          ) : (
            <>
              <span className="upload-icon">📷</span>
              OCR from Image
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {statusClass && (
          <span className={statusClass}>
            <span className="ocr-status-dot" />
            {isProcessing
              ? 'Processing...'
              : lastConfidence !== null
                ? `OCR: ${Math.round(lastConfidence)}%`
                : 'Failed'}
          </span>
        )}
      </div>

      {error && <p className="ocr-error">⚠️ {error}</p>}

      {preview && !isProcessing && lastConfidence !== null && (
        <div className="ocr-success-note">
          ✓ Text extracted and added to editor
        </div>
      )}

      {preview && (
        <div className="image-preview">
          <button
            className="image-preview-dismiss"
            onClick={clearPreview}
            title="Dismiss preview"
            type="button"
          >
            ✕
          </button>
          <img src={preview} alt="Uploaded preview" />
        </div>
      )}
    </div>
  );
}
