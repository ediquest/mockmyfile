import { escapeHtml } from '../xml/escape';

export const highlightJson = (json: string) => {
  const escaped = escapeHtml(json);
  return escaped
    .replace(/(&quot;.*?&quot;)(\s*:)?/g, (match, p1, p2) => {
      if (p2) {
        return `<span class="json-key">${p1}</span>${p2}`;
      }
      return `<span class="json-string">${p1}</span>`;
    })
    .replace(/\b(true|false|null)\b/g, '<span class="json-literal">$1</span>')
    .replace(/\b-?\d+(\.\d+)?\b/g, '<span class="json-number">$&</span>');
};
