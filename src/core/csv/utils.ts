export type CsvParseOptions = {
  delimiter?: string;
};

const DELIMITERS = [';', ',', '\t'] as const;

const countDelimiter = (line: string, delimiter: string) => {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) count += 1;
  }
  return count;
};

export const detectDelimiter = (line: string) => {
  let best: string = ';';
  let bestCount = -1;
  for (const delim of DELIMITERS) {
    const count = countDelimiter(line, delim);
    if (count > bestCount) {
      best = delim;
      bestCount = count;
    }
  }
  return best;
};

export const parseCsvLine = (line: string, delimiter: string) => {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
};

export const parseCsvText = (text: string, options: CsvParseOptions = {}) => {
  const normalized = text.replace(/\uFEFF/g, '').replace(/\u0000/g, '');
  const lines = normalized.split(/\r\n|\n|\r/);
  const firstLine = lines.find((line) => line.trim().length > 0);
  if (!firstLine) {
    return { ok: false as const, error: 'empty' as const };
  }
  const delimiter = options.delimiter ?? detectDelimiter(firstLine);
  const headers = parseCsvLine(firstLine, delimiter).map((h) => h.trim());
  const rows: string[][] = [];
  for (const line of lines.slice(lines.indexOf(firstLine) + 1)) {
    if (line.trim().length === 0) continue;
    rows.push(parseCsvLine(line, delimiter));
  }
  return { ok: true as const, delimiter, headers, rows };
};

export const escapeCsvValue = (value: string, delimiter: string) => {
  const shouldQuote =
    value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter);
  if (!shouldQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
};
