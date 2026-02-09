import { useState } from 'react';
import type { FieldSetting, StatusMessage } from '../../core/types';
import type { Preset } from '../../core/presets';
import { useI18n } from '../../i18n/I18nProvider';

export type GeneratePanelProps = {
  filesToGenerate: number;
  setFilesToGenerate: (value: number) => void;
  generateZip: () => void;
  status: StatusMessage | null;
  fields: FieldSetting[];
  updateField: (id: string, patch: Partial<FieldSetting>) => void;
  presets: Preset[];
  canSavePreset: boolean;
  onSavePreset: (name: string, description: string) => void;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
};

const GeneratePanel = ({
  filesToGenerate,
  setFilesToGenerate,
  generateZip,
  status,
  fields,
  updateField,
  presets,
  canSavePreset,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: GeneratePanelProps) => {
  const { t } = useI18n();
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<string | null>(null);
  const statusText = status
    ? 'key' in status
      ? t(status.key as never, status.params as never)
      : status.text
    : '';

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
        <button className="button primary" onClick={() => void generateZip()}>
          {t('generate.downloadZip')}
        </button>
      </div>
      <div className="panel-row">
        <div className="panel-actions">
          <input
            className="input"
            placeholder={t('presets.namePlaceholder')}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            disabled={!canSavePreset}
          />
          <input
            className="input"
            placeholder={t('presets.descriptionPlaceholder')}
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            disabled={!canSavePreset}
          />
          <button
            className="button ghost"
            onClick={() => {
              const trimmed = presetName.trim();
              if (!trimmed) return;
              onSavePreset(trimmed, presetDescription);
              setPresetName('');
              setPresetDescription('');
            }}
            disabled={!canSavePreset}
          >
            {t('presets.save')}
          </button>
          <select
            className="input"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
          >
            <option value="">{t('presets.select')}</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            className="button ghost"
            onClick={() => {
              if (!selectedPreset) return;
              onApplyPreset(selectedPreset);
            }}
            disabled={!selectedPreset}
          >
            {t('presets.apply')}
          </button>
          <button
            className="button danger"
            onClick={() => {
              if (!selectedPreset) return;
              setConfirmDeletePreset(selectedPreset);
            }}
            disabled={!selectedPreset}
          >
            {t('presets.delete')}
          </button>
        </div>
      </div>
      {statusText && <p className="status">{statusText}</p>}
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
                  {field.mode === 'random' && field.kind === 'boolean' && (
                    <>{t('generate.randomBoolean')}</>
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
      {confirmDeletePreset && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmDeletePreset(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t('presets.deleteConfirmTitle')}</h3>
            <p>{t('presets.deleteConfirmMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeletePreset(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeletePreset(confirmDeletePreset);
                  setConfirmDeletePreset(null);
                  setSelectedPreset('');
                }}
              >
                {t('presets.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default GeneratePanel;
