import type { FieldKind, FieldSetting, LoopSetting, ParseResult, XmlNode } from '../types';
import { detectRelations } from '../relations';
import { createFieldSetting } from '../templates';
import { detectKind } from '../xml/utils';
import { parseCsvText, type CsvParseOptions } from './utils';

const inferKind = (values: string[]): FieldKind => {
  let chosen: FieldKind | null = null;
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === 'null') continue;
    const detected = detectKind(trimmed);
    if (!chosen) {
      chosen = detected;
    } else if (chosen !== detected) {
      return 'text';
    }
  }
  return chosen ?? 'text';
};

const pickSample = (values: string[]) => {
  for (const raw of values) {
    if (raw.trim().length > 0) return raw;
  }
  return '';
};

export type CsvParseResult =
  | (ParseResult & { ok: false })
  | {
      ok: true;
      root: XmlNode;
      fields: FieldSetting[];
      loops: LoopSetting[];
      relations: ReturnType<typeof detectRelations>;
      delimiter: string;
    };

export const parseCsv = (text: string, options: CsvParseOptions = {}): CsvParseResult => {
  const parsed = parseCsvText(text, options);
  if (!parsed.ok) {
    return { ok: false, errorKey: 'error.csvParse' };
  }

  const { delimiter, headers, rows } = parsed;
  if (headers.length === 0) {
    return { ok: false, errorKey: 'error.csvParse' };
  }

  const columns = headers.map((header, index) => header || `column_${index + 1}`);
  const seen = new Map<string, number>();
  for (let i = 0; i < columns.length; i += 1) {
    const name = columns[i];
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) {
      columns[i] = `${name}_${count}`;
    }
  }
  const columnValues = columns.map(() => [] as string[]);
  rows.forEach((row) => {
    for (let i = 0; i < columns.length; i += 1) {
      columnValues[i].push(row[i] ?? '');
    }
  });

  const kinds = columnValues.map((values) => inferKind(values));
  const samples = columnValues.map((values) => pickSample(values));

  const itemNode: XmlNode = {
    tag: '[]',
    attrs: [],
    children: [],
    jsonType: 'object',
  };
  columns.forEach((col, index) => {
    itemNode.children.push({
      tag: col,
      attrs: [],
      children: [],
      jsonType: 'value',
      jsonValue: samples[index],
      jsonValueKind: kinds[index],
      jsonOriginalType: 'string',
    });
  });

  const root: XmlNode = {
    tag: 'root',
    attrs: [],
    children: [itemNode],
    jsonType: 'array',
    loopId: 'root[]',
  };

  const loops: LoopSetting[] = [
    { id: 'root[]', label: 'root[]', count: Math.max(1, rows.length) },
  ];

  const fields: FieldSetting[] = columns.map((col, index) =>
    createFieldSetting(`root[]/${col}`, samples[index], kinds[index]),
  );

  const relations = detectRelations(fields);

  return { ok: true, root, fields, loops, relations, delimiter };
};
