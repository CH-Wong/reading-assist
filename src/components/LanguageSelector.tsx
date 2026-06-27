import { LANGUAGE_OPTIONS } from '../utils/languages';
import type { Language, LanguageOption } from '../types';

interface LanguageSelectorProps {
  label: string;
  value: Language | 'auto';
  onChange: (lang: Language | 'auto') => void;
  includeAuto?: boolean;
}

export default function LanguageSelector({
  label,
  value,
  onChange,
  includeAuto = false,
}: LanguageSelectorProps) {
  const options = includeAuto
    ? LANGUAGE_OPTIONS
    : LANGUAGE_OPTIONS.filter(o => o.code !== 'auto');

  return (
    <div className="language-selector">
      <label className="lang-label">{label}</label>
      <select
        className="lang-select"
        value={value}
        onChange={e => onChange(e.target.value as Language | 'auto')}
      >
        {options.map(opt => (
          <option key={opt.code} value={opt.code}>
            {opt.label} ({opt.nativeLabel})
          </option>
        ))}
      </select>
    </div>
  );
}
