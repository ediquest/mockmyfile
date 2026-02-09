export const pad2 = (n: number) => String(n).padStart(2, '0');

export const detectKind = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'text' as const;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'number' as const;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dt = new Date(trimmed);
    if (!Number.isNaN(dt.getTime())) return 'date' as const;
  }
  return 'text' as const;
};

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const extractLineCol = (message: string) => {
  const lineColMatch = message.match(/line\s+(\d+)\s*(?:,|\s)column\s+(\d+)/i);
  if (lineColMatch) {
    return { line: Number(lineColMatch[1]), col: Number(lineColMatch[2]) };
  }
  const lineOnlyMatch = message.match(/line\s+(\d+)/i);
  if (lineOnlyMatch) {
    return { line: Number(lineOnlyMatch[1]) };
  }
  return null;
};

