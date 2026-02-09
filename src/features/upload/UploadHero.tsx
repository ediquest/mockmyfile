import { useState } from 'react';
import type { RefObject } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export type UploadHeroProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
};

const UploadHero = ({ fileInputRef, onFile }: UploadHeroProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useI18n();

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">MessageLab</p>
        <h1>{t('hero.title')}</h1>
        <p className="sub">{t('hero.subtitle')}</p>
      </div>
      <div className="hero-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <div
          className={`dropzone${isDragging ? ' is-dragover' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
        >
          <strong>{t('hero.dropzoneTitle')}</strong>
          <span>{t('hero.dropzoneHint')}</span>
        </div>
      </div>
    </header>
  );
};

export default UploadHero;
