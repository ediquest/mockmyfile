import type { Relation } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';

export type RelationsPanelProps = {
  relations: Relation[];
  updateRelation: (id: string, enabled: boolean) => void;
  focusRelation: (masterId: string, dependentId: string) => void;
};

const RelationsPanel = ({ relations, updateRelation, focusRelation }: RelationsPanelProps) => {
  const { t } = useI18n();

  return (
    <div className="panel">
      <h2>{t('relations.title')}</h2>
      {relations.length === 0 && <p className="muted">{t('relations.empty')}</p>}
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
            <span>{t('relations.linked')}</span>
          </label>
        </div>
      ))}
    </div>
  );
};

export default RelationsPanel;
