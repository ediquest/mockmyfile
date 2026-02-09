import { BOOLEAN_VALUES, MIN_RELATION_LENGTH } from './constants';
import type { FieldSetting, Relation } from './types';

export const detectRelations = (fields: FieldSetting[]): Relation[] => {
  const relations: Relation[] = [];
  const byValue = new Map<string, FieldSetting[]>();

  for (const field of fields) {
    const v = field.value.trim();
    if (v.length < MIN_RELATION_LENGTH) continue;
    const lowered = v.toLowerCase();
    if (BOOLEAN_VALUES.has(lowered) || lowered === 'null') continue;
    if (!byValue.has(v)) byValue.set(v, []);
    byValue.get(v)!.push(field);
  }

  for (const group of byValue.values()) {
    if (group.length < 2) continue;
    const master = group[0];
    for (let i = 1; i < group.length; i += 1) {
      relations.push({
        id: `${master.id}::${group[i].id}::exact`,
        masterId: master.id,
        dependentId: group[i].id,
        prefix: '',
        suffix: '',
        enabled: true,
      });
    }
  }

  const unique = new Map<string, Relation>();
  for (const rel of relations) {
    unique.set(rel.id, rel);
  }
  return Array.from(unique.values());
};

export const normalizeRelation = (rel: Relation): Relation => ({
  ...rel,
  prefix: rel.prefix ?? '',
  suffix: rel.suffix ?? '',
  enabled: rel.enabled ?? true,
});

