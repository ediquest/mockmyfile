import type { FieldSetting, LoopSetting, ParseResult } from '../types';
import { detectRelations } from '../relations';
import { buildNode, flattenFields, normalizeLoops } from './tree';

export const parseXml = (xmlText: string): ParseResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    return { ok: false, error: 'Nie udało się sparsować XML. Sprawdź poprawność pliku.' };
  }
  const rootEl = doc.documentElement;
  const root = buildNode(rootEl);
  const loops: LoopSetting[] = [];
  normalizeLoops(root, `/${root.tag}`, loops);
  const fields: FieldSetting[] = [];
  flattenFields(root, `/${root.tag}`, fields);
  const relations = detectRelations(fields);
  return { ok: true, root, fields, loops, relations };
};

