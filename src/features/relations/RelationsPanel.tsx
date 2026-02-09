import type { Relation } from '../../core/types';

export type RelationsPanelProps = {
  relations: Relation[];
  updateRelation: (id: string, enabled: boolean) => void;
  focusRelation: (masterId: string, dependentId: string) => void;
};

const RelationsPanel = ({ relations, updateRelation, focusRelation }: RelationsPanelProps) => (
  <div className="panel">
    <h2>Relacje</h2>
    {relations.length === 0 && <p className="muted">Brak wykrytych relacji.</p>}
    {relations.map((rel) => (
      <div
        className="relation"
        key={rel.id}
        role="button"
        tabIndex={0}
        onClick={() => focusRelation(rel.masterId, rel.dependentId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusRelation(rel.masterId, rel.dependentId);
          }
        }}
      >
        <div>
          <strong>{rel.masterId}</strong>
          <span>› {rel.dependentId}</span>
        </div>
        <label className="switch" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={rel.enabled}
            onChange={(e) => updateRelation(rel.id, e.target.checked)}
          />
          <span>Powiązane</span>
        </label>
      </div>
    ))}
  </div>
);

export default RelationsPanel;

