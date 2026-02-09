import type { LoopSetting } from '../../core/types';

export type LoopsPanelProps = {
  loops: LoopSetting[];
  updateLoop: (id: string, count: number) => void;
};

const LoopsPanel = ({ loops, updateLoop }: LoopsPanelProps) => (
  <div className="panel">
    <h2>Pętle</h2>
    {loops.length === 0 && <p className="muted">Brak powtarzających się sekcji.</p>}
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

export default LoopsPanel;

