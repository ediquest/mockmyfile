import type { FieldSetting } from '../../core/types';

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
}: GeneratePanelProps) => (
  <section className="panel">
    <h2>Generowanie</h2>
    <div className="field-row start">
      <label>Liczba plików</label>
      <input
        type="number"
        min={1}
        className="input"
        value={filesToGenerate}
        onChange={(e) => setFilesToGenerate(Number(e.target.value) || 1)}
      />
    </div>
    <button className="button primary" onClick={() => void generateZip()}>
      Pobierz ZIP
    </button>
    {status && <p className="status">{status}</p>}
    <div className="summary">
      <h3>Podsumowanie zmian</h3>
      {fields.filter((field) => field.mode !== 'same').length === 0 && (
        <p className="muted">Brak wybranych zmian.</p>
      )}
      {fields
        .filter((field) => field.mode !== 'same')
        .map((field) => (
          <div className="summary-row" key={field.id}>
            <strong>{field.label}</strong>
            <div className="summary-meta">
              <span>
                {field.mode === 'fixed' && `Stała wartość: ${field.fixedValue}`}
                {field.mode === 'increment' && `Inkrementacja: +${field.step}`}
                {field.mode === 'random' && field.kind === 'number' && (
                  <>
                    Random liczby
                    {field.length > 0
                      ? ` (${field.length} cyfr)`
                      : ` (${field.min}-${field.max})`}
                  </>
                )}
                {field.mode === 'random' && field.kind === 'text' && (
                  <>Random tekst ({field.length} znaków)</>
                )}
                {field.mode === 'random' && field.kind === 'date' && (
                  <>Random data (+{field.dateSpanDays} dni)</>
                )}
              </span>
              <button
                type="button"
                className="summary-remove"
                onClick={() => updateField(field.id, { mode: 'same' })}
                title="Usuń zmianę"
              >
                ×
              </button>
            </div>
          </div>
        ))}
    </div>
  </section>
);

export default GeneratePanel;

