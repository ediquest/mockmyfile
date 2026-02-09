import type { RefObject } from 'react';

export type BackupPanelProps = {
  backupInputRef: RefObject<HTMLInputElement | null>;
  exportBackup: () => void;
  importBackup: (file: File) => void;
};

const BackupPanel = ({ backupInputRef, exportBackup, importBackup }: BackupPanelProps) => (
  <section className="panel backup">
    <div>
      <h2>Backup</h2>
      <p>Eksportuj lub zaimportuj wszystkie projekty i interfejsy.</p>
    </div>
    <div className="panel-actions">
      <button className="button ghost" onClick={exportBackup}>
        Eksport JSON
      </button>
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importBackup(file);
        }}
      />
      <button className="button" onClick={() => backupInputRef.current?.click()}>
        Import JSON
      </button>
    </div>
  </section>
);

export default BackupPanel;


