export const formatXml = (xmlText: string, indent = '  ') => {
  const trimmed = xmlText.trim();
  if (!trimmed) return xmlText;

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) return xmlText;

  const serialized = new XMLSerializer().serializeToString(doc);
  const hasDeclaration = /^\s*<\?xml\b/.test(trimmed);
  const normalized = serialized.replace(/>\s*</g, '><');
  const lines = normalized.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n');

  let pad = 0;
  let formatted = '';
  for (const line of lines) {
    if (/^<\/\w/.test(line)) {
      pad = Math.max(pad - 1, 0);
    }
    formatted += `${indent.repeat(pad)}${line}\n`;
    if (/^<\w[^>]*[^/]>$/.test(line)) {
      pad += 1;
    }
  }

  const body = formatted.trim();
  if (!hasDeclaration) return body;
  const declMatch = trimmed.match(/^\s*(<\?xml[\s\S]*?\?>)/);
  return declMatch ? `${declMatch[1]}\n${body}` : body;
};
