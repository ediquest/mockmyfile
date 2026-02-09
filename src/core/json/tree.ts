import type { FieldKind, FieldSetting, LoopSetting, XmlNode } from '../types';
import { createFieldSetting } from '../templates';
import { detectKind } from '../xml/utils';

const detectJsonStringKind = (value: string): FieldKind => {
  const detected = detectKind(value);
  if (detected === 'number' || detected === 'date') return detected;
  return 'text';
};

const getValueKind = (value: unknown): FieldKind => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return detectJsonStringKind(value);
  return 'text';
};

const valueToString = (value: unknown) => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'string') return value;
  return '';
};

const getOriginalType = (value: unknown): 'string' | 'number' | 'boolean' | 'null' => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
};

export const buildJsonNode = (
  value: unknown,
  tag: string,
  path: string,
  loops: LoopSetting[],
): XmlNode => {
  if (Array.isArray(value)) {
    const loopId = `${path}[]`;
    const count = Math.max(1, value.length);
    loops.push({ id: loopId, label: loopId, count });
    const itemValue = value.length > 0 ? value[0] : null;
    const itemNode = buildJsonNode(itemValue, '[]', `${path}[]`, loops);
    return {
      tag,
      attrs: [],
      children: [itemNode],
      jsonType: 'array',
      loopId,
    };
  }

  if (value && typeof value === 'object') {
    const children = Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
      buildJsonNode(entry, key, `${path}/${key}`, loops),
    );
    return {
      tag,
      attrs: [],
      children,
      jsonType: 'object',
    };
  }

  const stringValue = valueToString(value);
  const kind = getValueKind(value);
  const originalType = getOriginalType(value);
  return {
    tag,
    attrs: [],
    children: [],
    jsonType: 'value',
    jsonValue: stringValue,
    jsonValueKind: kind,
    jsonOriginalType: originalType,
  };
};

export const flattenJsonFields = (node: XmlNode, path: string, fields: FieldSetting[]) => {
  if (node.jsonType === 'value') {
    const kind = node.jsonValueKind ?? getValueKind(node.jsonValue ?? '');
    const value = node.jsonValue ?? '';
    fields.push(createFieldSetting(path.replace(/^\//, ''), value, kind));
    return;
  }

  if (node.jsonType === 'array') {
    const item = node.children[0];
    if (item) {
      flattenJsonFields(item, `${path}[]`, fields);
    }
    return;
  }

  node.children.forEach((child) => {
    flattenJsonFields(child, `${path}/${child.tag}`, fields);
  });
};

export const collectJsonPaths = (node: XmlNode, path: string, paths: string[]) => {
  const normalized = path.replace(/^\//, '').replace(/\[\d+\]/g, '[]');
  paths.push(normalized);
  if (node.jsonType === 'array') {
    const child = node.children[0];
    if (child) collectJsonPaths(child, `${path}[]`, paths);
    return;
  }
  node.children.forEach((child) => collectJsonPaths(child, `${path}/${child.tag}`, paths));
};
