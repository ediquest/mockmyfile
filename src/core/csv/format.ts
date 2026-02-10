import { escapeCsvValue, parseCsvText } from './utils';

export const formatCsv = (text: string) => {
  const normalized = text.replace(/\uFEFF/g, '').replace(/\u0000/g, '');
  const trimmed = normalized.trim();
  if (!trimmed) return text;
  const parsed = parseCsvText(trimmed);
  if (!parsed.ok) return text;

  const { delimiter, headers, rows } = parsed;
  const lines: string[] = [];
  lines.push(headers.map((value) => escapeCsvValue(value, delimiter)).join(delimiter));
  rows.forEach((row) => {
    lines.push(row.map((value) => escapeCsvValue(value ?? '', delimiter)).join(delimiter));
  });
  return `${lines.join('\n')}\n`;
};
