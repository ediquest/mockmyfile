import type { LoopSetting } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';

export type LoopsPanelProps = {
  loops: LoopSetting[];
  updateLoop: (id: string, count: number) => void;
};

const LoopsPanel = ({ loops, updateLoop }: LoopsPanelProps) => {
  const { t } = useI18n();

  return (
    <div className="panel">
      <h2>{t('loops.title')}</h2>
      {loops.length === 0 && <p className="muted">{t('loops.empty')}</p>}
      {loops.map((loop) => (
        <div className="field-row" key={loop.id}>
          <label>{loop.label}</label>
          <input
            type="number"
            min={1}
            className="input"
            value={loop.count}
            onChange={(e) => updateLoop(loop.id, Number(e.target.value) || 1)}
          />
        </div>
      ))}
    </div>
  );
};

export default LoopsPanel;
