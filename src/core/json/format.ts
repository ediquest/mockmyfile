export const formatJson = (jsonText: string) => {
  const normalized = jsonText.replace(/\uFEFF/g, '').replace(/\u0000/g, '');
  const trimmed = normalized.trim();
  if (!trimmed) return jsonText;
  try {
    const value = JSON.parse(trimmed) as unknown;
    return `${JSON.stringify(value, null, 2)}\n`;
  } catch {
    return jsonText;
  }
};
