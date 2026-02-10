import type { FieldSetting, LoopSetting, Relation } from './types';

export type PresetField = Pick<
  FieldSetting,
  | 'id'
  | 'mode'
  | 'fixedValue'
  | 'step'
  | 'min'
  | 'max'
  | 'length'
  | 'dateSpanDays'
  | 'listText'
  | 'listScope'
>;

export type PresetLoop = Pick<LoopSetting, 'id' | 'count'>;

export type PresetRelation = Pick<Relation, 'id' | 'enabled' | 'prefix' | 'suffix'>;

export type Preset = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  fields: PresetField[];
  loops: PresetLoop[];
  relations: PresetRelation[];
};

const PRESETS_KEY = 'messagelab.presets';

type PresetsMap = Record<string, Preset[]>;

const readPresets = (): PresetsMap => {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PresetsMap;
  } catch {
    return {};
  }
};

const writePresets = (map: PresetsMap) => {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(map));
};

export const getPresetsForTemplate = (templateId: string) => {
  const map = readPresets();
  return map[templateId] ?? [];
};

export const savePresetForTemplate = (templateId: string, preset: Preset) => {
  const map = readPresets();
  const next = map[templateId] ? [...map[templateId]] : [];
  next.push(preset);
  map[templateId] = next;
  writePresets(map);
};

export const deletePresetForTemplate = (templateId: string, presetId: string) => {
  const map = readPresets();
  const next = (map[templateId] ?? []).filter((p) => p.id !== presetId);
  map[templateId] = next;
  writePresets(map);
};

export const updatePresetForTemplate = (
  templateId: string,
  presetId: string,
  patch: { name?: string; description?: string },
) => {
  const map = readPresets();
  const next = (map[templateId] ?? []).map((preset) =>
    preset.id === presetId ? { ...preset, ...patch } : preset,
  );
  map[templateId] = next;
  writePresets(map);
};

export const getPresetsMap = () => readPresets();
