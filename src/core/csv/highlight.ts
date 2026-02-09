import { escapeHtml } from '../xml/escape';

export const highlightCsv = (csv: string) => escapeHtml(csv);
