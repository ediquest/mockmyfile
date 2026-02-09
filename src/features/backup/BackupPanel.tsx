import type { RefObject } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export type BackupPanelProps = {
  backupInputRef: RefObject<HTMLInputElement | null>;
  exportBackup: () => void;
  importBackup: (file: File) => void;
};

const BackupPanel = ({ backupInputRef, exportBackup, importBackup }: BackupPanelProps) => {
  const { t } = useI18n();

  return (
    <section className="panel backup">
      <div>
        <h2>{t('backup.title')}</h2>
        <p>{t('backup.subtitle')}</p>
      </div>
      <div className="panel-actions">
        <button className="button ghost" onClick={exportBackup}>
          {t('backup.exportJson')}
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
          {t('backup.importJson')}
        </button>
      </div>
    </section>
  );
};

export default BackupPanel;
