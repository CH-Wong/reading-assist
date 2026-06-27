import { useRef, useState } from 'react';
import type { Language } from '../types';
import LanguageSelector from './LanguageSelector';

interface ImageUploadProps {
  onTextExtracted: (text: string) => void;
  sourceLang: Language | 'auto';
  onSourceLangChange: (lang: Language | 'auto') => void;
}

export default function ImageUpload({
  onTextExtracted,
  sourceLang,
  onSourceLangChange,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    // Show preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      // Dynamically import the OCR service
      const { extractTextFromImage } = await import('../services/ocr');
      const result = await extractTextFromImage(file, sourceLang);

      if (result.text) {
        onTextExtracted(result.text);
      } else {
        setError('No text could be extracted from this image. Try a clearer image.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed');
    } finally {
      setIsProcessing(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

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
        >
          {isProcessing ? (
            <>
              <span className="spinner spinner--small" />
              Processing...
            </>
          ) : (
            <>
              <span className="upload-icon">📷</span>
              Upload Image
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
      </div>

      {error && <p className="ocr-error">⚠️ {error}</p>}

      {preview && !isProcessing && (
        <div className="image-preview">
          <img src={preview} alt="Uploaded preview" />
        </div>
      )}
    </div>
  );
}
