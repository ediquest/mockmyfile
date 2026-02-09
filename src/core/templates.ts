import type { FieldKind, FieldSetting } from './types';
import { detectKind } from './xml/utils';

export const normalizeId = (value: string) => value.replace(/^\//, '');
export const stripLoopMarkers = (value: string) => value.replace(/\[\]/g, '');
export const normalizeLoopId = (value: string) => stripLoopMarkers(value);

export const createFieldSetting = (
  id: string,
  value: string,
  kindOverride?: FieldKind,
): FieldSetting => {
  const kind = kindOverride ?? detectKind(value);
  return {
    id,
    label: id,
    value,
    kind,
    mode: 'same',
    step: 1,
    min: 0,
    max: 9999,
    length: Math.max(value.length, 6),
    dateSpanDays: 30,
    fixedValue: value,
  };
};

export const normalizeFieldSetting = (field: FieldSetting): FieldSetting => {
  let mode = field.mode ?? 'same';
  if (field.kind === 'null') {
    mode = 'same';
  } else if (field.kind === 'boolean' && mode === 'increment') {
    mode = 'same';
  }
  return {
    ...field,
    mode,
    step: Number.isFinite(field.step) ? field.step : 1,
    min: Number.isFinite(field.min) ? field.min : 0,
    max: Number.isFinite(field.max) ? field.max : 9999,
    length: Number.isFinite(field.length) ? field.length : Math.max(field.value.length, 6),
    dateSpanDays: Number.isFinite(field.dateSpanDays) ? field.dateSpanDays : 30,
    fixedValue: field.fixedValue ?? field.value,
  };
};

export const getBaseName = (fileName: string) => {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
};
