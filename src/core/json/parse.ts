import type { FieldSetting, LoopSetting, ParseResult } from '../types';
import { detectRelations } from '../relations';
import { buildJsonNode, flattenJsonFields } from './tree';

export const parseJson = (jsonText: string): ParseResult => {
  try {
    const normalized = jsonText.replace(/\uFEFF/g, '').replace(/\u0000/g, '');
    const value = JSON.parse(normalized) as unknown;
    const loops: LoopSetting[] = [];
    const rootTag = 'root';
    const root = buildJsonNode(value, rootTag, `/${rootTag}`, loops);
    const fields: FieldSetting[] = [];
    flattenJsonFields(root, `/${rootTag}`, fields);
    const relations = detectRelations(fields);
    return { ok: true, root, fields, loops, relations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/position\s+(\d+)/i);
    if (match) {
      const pos = Number(match[1]);
      if (Number.isFinite(pos)) {
        const normalized = jsonText.replace(/\uFEFF/g, '').replace(/\u0000/g, '');
        const slice = normalized.slice(0, pos);
        const lines = slice.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1]?.length ?? 0;
        return { ok: false, errorKey: 'error.jsonParse', errorDetail: `line ${line}, col ${col + 1}` };
      }
    }
    return { ok: false, errorKey: 'error.jsonParse', errorDetail: message };
  }
};
