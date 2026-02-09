import type { FieldSetting } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';

export type GeneratePanelProps = {
  filesToGenerate: number;
  setFilesToGenerate: (value: number) => void;
  generateZip: () => void;
  status: string;
  fields: FieldSetting[];
  updateField: (id: string, patch: Partial<FieldSetting>) => void;
};

const GeneratePanel = ({
  filesToGenerate,
  setFilesToGenerate,
  generateZip,
  status,
  fields,
  updateField,
}: GeneratePanelProps) => {
  const { t } = useI18n();

  return (
    <section className="panel">
      <h2>{t('generate.title')}</h2>
      <div className="field-row start">
        <label>{t('generate.filesCountLabel')}</label>
        <input
          type="number"
          min={1}
          className="input"
          value={filesToGenerate}
          onChange={(e) => setFilesToGenerate(Number(e.target.value) || 1)}
        />
      </div>
      <button className="button primary" onClick={() => void generateZip()}>
        {t('generate.downloadZip')}
      </button>
      {status && <p className="status">{status}</p>}
      <div className="summary">
        <h3>{t('generate.summaryTitle')}</h3>
        {fields.filter((field) => field.mode !== 'same').length === 0 && (
          <p className="muted">{t('generate.noChanges')}</p>
        )}
        {fields
          .filter((field) => field.mode !== 'same')
          .map((field) => (
            <div className="summary-row" key={field.id}>
              <strong>{field.label}</strong>
              <div className="summary-meta">
                <span>
                  {field.mode === 'fixed' && t('generate.fixedValue', { value: field.fixedValue })}
                  {field.mode === 'increment' &&
                    t('generate.increment', { step: field.step })}
                  {field.mode === 'random' && field.kind === 'number' && (
                    <>
                      {t('generate.randomNumber')}
                      {field.length > 0
                        ? ` (${t('generate.randomDigits', { count: field.length })})`
                        : ` (${t('generate.randomRange', { min: field.min, max: field.max })})`}
                    </>
                  )}
                  {field.mode === 'random' && field.kind === 'text' && (
                    <>
                      {t('generate.randomText')} (
                      {t('generate.randomChars', { count: field.length })})
                    </>
                  )}
                  {field.mode === 'random' && field.kind === 'date' && (
                    <>
                      {t('generate.randomDate')} ({t('generate.randomDays', { days: field.dateSpanDays })})
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="summary-remove"
                  onClick={() => updateField(field.id, { mode: 'same' })}
                  title={t('generate.removeChangeTitle')}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
};

export default GeneratePanel;
