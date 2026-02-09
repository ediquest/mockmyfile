import { escapeHtml } from './escape';

export const highlightXml = (xml: string) => {
  const escaped = escapeHtml(xml);
  return escaped
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>')
    .replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="xml-decl">$1</span>')
    .replace(/(&lt;\/?[^&]*?&gt;)/g, (match) => {
      return match
        .replace(/(&lt;\/?)([\w:-]+)/, '$1<span class="xml-tag">$2</span>')
        .replace(
          /([\w:-]+)(=)(&quot;[^&]*?&quot;)/g,
          '<span class="xml-attr">$1</span>$2<span class="xml-value">$3</span>',
        );
    });
};

export const highlightText = (value: string, query: string) => {
  if (!query) return value;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safe})`, 'gi');
  return value.replace(regex, '<mark class="tree-mark">$1</mark>');
};

