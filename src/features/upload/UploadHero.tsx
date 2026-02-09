import type { RefObject } from 'react';

export type UploadHeroProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
};

const UploadHero = ({ fileInputRef, onFile }: UploadHeroProps) => (
  <header className="hero">
    <div>
      <p className="eyebrow">MessageLab</p>
      <h1>Laboratorium plików testowych z XML</h1>
      <p className="sub">
        Wgraj XML, ustaw reguły, wykryj relacje i wygeneruj paczkę danych do testów.
      </p>
    </div>
    <div className="hero-actions">
      <label className="upload">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        Wczytaj XML
      </label>
      <div
        className="dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <strong>Drag & Drop</strong>
        <span>Upuść plik XML tutaj lub kliknij, aby wybrać</span>
      </div>
    </div>
  </header>
);

export default UploadHero;


