import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import './App.css';

type XmlAttr = {
  name: string;
  value: string;
};

type XmlNode = {
  tag: string;
  attrs: XmlAttr[];
  children: XmlNode[];
  text?: string;
  loopId?: string;
};

type FieldKind = 'text' | 'number' | 'date';

type FieldMode = 'same' | 'increment' | 'random' | 'fixed';

type FieldSetting = {
  id: string;
  label: string;
  value: string;
  kind: FieldKind;
  mode: FieldMode;
  step: number;
  min: number;
  max: number;
  length: number;
  dateSpanDays: number;
  fixedValue: string;
};

type LoopSetting = {
  id: string;
  label: string;
  count: number;
};

type Relation = {
  id: string;
  masterId: string;
  dependentId: string;
  prefix: string;
  suffix: string;
  enabled: boolean;
};

type TemplatePayload = {
  id: string;
  name: string;
  project: string;
  xmlText: string;
  fields: FieldSetting[];
  loops: LoopSetting[];
  relations: Relation[];
  fileName: string;
};

const STORAGE_KEY = 'messagelab.templates';
const LAST_KEY = 'messagelab.last';
const PROJECTS_KEY = 'messagelab.projects';
const NO_PROJECT = '__none__';
const MIN_RELATION_LENGTH = 3;
const BOOLEAN_VALUES = new Set(['true', 'false']);

const pad2 = (n: number) => String(n).padStart(2, '0');

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const highlightXml = (xml: string) => {
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

const highlightText = (value: string, query: string) => {
  if (!query) return value;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safe})`, 'gi');
  return value.replace(regex, '<mark class="tree-mark">$1</mark>');
};

const extractLineCol = (message: string) => {
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

const normalizeId = (value: string) => value.replace(/^\//, '');
const stripLoopMarkers = (value: string) => value.replace(/\[\]/g, '');
const normalizeLoopId = (value: string) => stripLoopMarkers(value);

const detectKind = (value: string): FieldKind => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'text';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'number';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dt = new Date(trimmed);
    if (!Number.isNaN(dt.getTime())) return 'date';
  }
  return 'text';
};

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getTemplates = (): TemplatePayload[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const persistTemplates = (templates: TemplatePayload[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
};

const getProjects = (): string[] => {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const persistProjects = (projects: string[]) => {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

const buildNode = (element: Element): XmlNode => {
  const attrs: XmlAttr[] = [];
  for (const attr of Array.from(element.attributes)) {
    attrs.push({ name: attr.name, value: attr.value });
  }
  const children = Array.from(element.children).map(buildNode);
  const text = element.childElementCount === 0 ? element.textContent ?? '' : undefined;
  return { tag: element.tagName, attrs, children, text };
};

const normalizeLoops = (
  node: XmlNode,
  path: string,
  loops: LoopSetting[],
): XmlNode => {
  const counts: Record<string, number> = {};
  for (const child of node.children) {
    counts[child.tag] = (counts[child.tag] || 0) + 1;
  }

  const normalizedChildren: XmlNode[] = [];
  const seen: Record<string, number> = {};

  for (const child of node.children) {
    seen[child.tag] = (seen[child.tag] || 0) + 1;
    const total = counts[child.tag];

    if (total > 1) {
      if (seen[child.tag] === 1) {
        const loopId = `${path}/${child.tag}`;
        loops.push({ id: loopId, label: loopId, count: total });
        child.loopId = loopId;
        normalizedChildren.push(child);
      }
    } else {
      normalizedChildren.push(child);
    }
  }

  node.children = normalizedChildren.map((child) =>
    normalizeLoops(child, `${path}/${child.tag}`, loops),
  );
  return node;
};

const createFieldSetting = (id: string, value: string): FieldSetting => ({
  id,
  label: id,
  value,
  kind: detectKind(value),
  mode: 'same',
  step: 1,
  min: 0,
  max: 9999,
  length: Math.max(value.length, 6),
  dateSpanDays: 30,
  fixedValue: value,
});

const normalizeFieldSetting = (field: FieldSetting): FieldSetting => ({
  ...field,
  mode: field.mode ?? 'same',
  step: Number.isFinite(field.step) ? field.step : 1,
  min: Number.isFinite(field.min) ? field.min : 0,
  max: Number.isFinite(field.max) ? field.max : 9999,
  length: Number.isFinite(field.length) ? field.length : Math.max(field.value.length, 6),
  dateSpanDays: Number.isFinite(field.dateSpanDays) ? field.dateSpanDays : 30,
  fixedValue: field.fixedValue ?? field.value,
});

const normalizeRelation = (rel: Relation): Relation => ({
  ...rel,
  prefix: rel.prefix ?? '',
  suffix: rel.suffix ?? '',
  enabled: rel.enabled ?? true,
});

const flattenFields = (node: XmlNode, path: string, fields: FieldSetting[]) => {
  const label = normalizeId(path);

  for (const attr of node.attrs) {
    const attrId = `${label}/@${attr.name}`;
    fields.push(createFieldSetting(attrId, attr.value));
  }

  if (node.children.length === 0 && node.text !== undefined) {
    const value = node.text.trim();
    if (value.length > 0) {
      fields.push(createFieldSetting(label, value));
    }
  }

  for (const child of node.children) {
    const childLabel = child.loopId ? `${path}/${child.tag}[]` : `${path}/${child.tag}`;
    flattenFields(child, childLabel, fields);
  }
};

const detectRelations = (fields: FieldSetting[]): Relation[] => {
  const relations: Relation[] = [];
  const byValue = new Map<string, FieldSetting[]>();

  for (const field of fields) {
    const v = field.value.trim();
    if (v.length < MIN_RELATION_LENGTH) continue;
    if (BOOLEAN_VALUES.has(v.toLowerCase())) continue;
    if (!byValue.has(v)) byValue.set(v, []);
    byValue.get(v)!.push(field);
  }

  for (const group of byValue.values()) {
    if (group.length < 2) continue;
    const master = group[0];
    for (let i = 1; i < group.length; i += 1) {
      relations.push({
        id: `${master.id}::${group[i].id}::exact`,
        masterId: master.id,
        dependentId: group[i].id,
        prefix: '',
        suffix: '',
        enabled: true,
      });
    }
  }

  const unique = new Map<string, Relation>();
  for (const rel of relations) {
    unique.set(rel.id, rel);
  }
  return Array.from(unique.values());
};

const parseXml = (xmlText: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    return { error: 'Nie udało się sparsować XML. Sprawdź poprawność pliku.' };
  }
  const rootEl = doc.documentElement;
  const root = buildNode(rootEl);
  const loops: LoopSetting[] = [];
  normalizeLoops(root, `/${root.tag}`, loops);
  const fields: FieldSetting[] = [];
  flattenFields(root, `/${root.tag}`, fields);
  const relations = detectRelations(fields);
  return { root, fields, loops, relations };
};

const getBaseName = (fileName: string) => {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
};

const collectPaths = (node: XmlNode, path: string, paths: string[]) => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  paths.push(templatePath);
  node.children.forEach((child) =>
    collectPaths(child, `${path}/${child.tag}${child.loopId ? '[]' : ''}`, paths),
  );
};

const getExpandedKey = (templateId: string) => `messagelab.expanded.${templateId}`;
const BACKUP_FILE_NAME = 'messagelab-backup.json';
const MAX_SUGGESTIONS = 8;

const applyLoopMarker = (
  node: XmlNode,
  path: string,
  targetPath: string,
  loopId: string,
): XmlNode => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  const nextChildren = node.children.map((child) =>
    applyLoopMarker(
      child,
      `${path}/${child.tag}${child.loopId ? '[]' : ''}`,
      targetPath,
      loopId,
    ),
  );
  const nextNode = { ...node, children: nextChildren };
  if (templatePath === targetPath) {
    return { ...nextNode, loopId: normalizeLoopId(loopId) };
  }
  return nextNode;
};

const clearLoopMarker = (
  node: XmlNode,
  path: string,
  targetPath: string,
): XmlNode => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  const nextChildren = node.children.map((child) =>
    clearLoopMarker(
      child,
      `${path}/${child.tag}${child.loopId ? '[]' : ''}`,
      targetPath,
    ),
  );
  const nextNode = { ...node, children: nextChildren };
  if (templatePath === targetPath) {
    return { ...nextNode, loopId: undefined };
  }
  return nextNode;
};

const App = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [xmlText, setXmlText] = useState('');
  const [fileName, setFileName] = useState('');
  const [root, setRoot] = useState<XmlNode | null>(null);
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [loops, setLoops] = useState<LoopSetting[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplateList] = useState<TemplatePayload[]>(getTemplates());
  const [projects, setProjects] = useState<string[]>(getProjects());
  const [projectName, setProjectName] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [newProject, setNewProject] = useState('');
  const [filesToGenerate, setFilesToGenerate] = useState(10);
  const [status, setStatus] = useState('');
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [highlightPath, setHighlightPath] = useState<string>('');
  const [showLoopInstances, setShowLoopInstances] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedXml, setEditedXml] = useState('');
  const [xmlError, setXmlError] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [treeQuery, setTreeQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const xmlInputRef = useRef<HTMLTextAreaElement | null>(null);
  const xmlPreviewRef = useRef<HTMLPreElement | null>(null);
  const xmlGutterRef = useRef<HTMLDivElement | null>(null);
  const xmlValidateTimeout = useRef<number | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const lastId = localStorage.getItem(LAST_KEY);
    if (!lastId) return;
    const found = templates.find((t) => t.id === lastId);
    if (found) {
      loadTemplate(found);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!editMode) return;
    if (xmlValidateTimeout.current) {
      window.clearTimeout(xmlValidateTimeout.current);
    }
    xmlValidateTimeout.current = window.setTimeout(() => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editedXml, 'application/xml');
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        const details = extractLineCol(parseError.textContent ?? '');
        if (details?.line && details?.col) {
          setXmlError(
            `Błąd składni XML — linia ${details.line}, kolumna ${details.col}.`,
          );
        } else if (details?.line) {
          setXmlError(`Błąd składni XML — linia ${details.line}.`);
        } else {
          setXmlError('Błąd składni XML — popraw plik przed zapisem.');
        }
      } else {
        setXmlError('');
      }
    }, 300);
    return () => {
      if (xmlValidateTimeout.current) {
        window.clearTimeout(xmlValidateTimeout.current);
      }
    };
  }, [editedXml, editMode]);

  const relationByDependent = useMemo(() => {
    const map = new Map<string, Relation>();
    for (const rel of relations) {
      if (!rel.enabled) continue;
      if (!map.has(rel.dependentId)) {
        map.set(rel.dependentId, rel);
      }
    }
    return map;
  }, [relations]);

  const relationHighlight = useMemo(() => {
    const map = new Map<string, 'master' | 'dependent'>();
    for (const rel of relations) {
      if (!rel.enabled) continue;
      map.set(rel.masterId, 'master');
      if (!map.has(rel.dependentId)) {
        map.set(rel.dependentId, 'dependent');
      }
    }
    return map;
  }, [relations]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseXml(text);
    if ('error' in parsed) {
      setStatus(parsed.error);
      return;
    }
    setStatus('');
    setXmlText(text);
    setEditedXml(text);
    setXmlError('');
    setFileName(file.name);
    setRoot(parsed.root);
    setFields(parsed.fields);
    setLoops(parsed.loops);
    setRelations(parsed.relations);
    setTemplateName(getBaseName(file.name));
    const paths: string[] = [];
    collectPaths(parsed.root, `/${parsed.root.tag}`, paths);
    const collapsed: Record<string, boolean> = {};
    paths.forEach((p) => {
      collapsed[p] = false;
    });
    setExpandedMap(collapsed);
    setActiveTemplateId('');
  };

  const saveTemplate = () => {
    if (!root) return;
    const trimmedProject = projectName.trim();
    const id = templateName.trim() || `template-${Date.now()}`;
    const payload: TemplatePayload = {
      id,
      name: templateName.trim() || id,
      project: trimmedProject,
      xmlText,
      fields,
      loops,
      relations,
      fileName,
    };
    const next = templates.filter((t) => t.id !== id).concat(payload);
    persistTemplates(next);
    setTemplateList(next);
    localStorage.setItem(LAST_KEY, id);
    setStatus('Szablon zapisany w LocalStorage.');
    if (trimmedProject && !projects.includes(trimmedProject)) {
      const updated = [...projects, trimmedProject].sort();
      setProjects(updated);
      persistProjects(updated);
    }
  };

  const loadTemplate = (tpl: TemplatePayload) => {
    setXmlText(tpl.xmlText);
    setEditedXml(tpl.xmlText);
    setXmlError('');
    setFileName(tpl.fileName);
    setFields(tpl.fields.map(normalizeFieldSetting));
    setLoops(tpl.loops);
    setRelations(tpl.relations.map(normalizeRelation));
    setTemplateName(tpl.name);
    setProjectName(tpl.project || '');
    const parsed = parseXml(tpl.xmlText);
    if ('error' in parsed) {
      setStatus(parsed.error);
      return;
    }
    setRoot(parsed.root);
    setStatus('Szablon wczytany.');
    setActiveTemplateId(tpl.id);
    const paths: string[] = [];
    collectPaths(parsed.root, `/${parsed.root.tag}`, paths);
    const stored = localStorage.getItem(getExpandedKey(tpl.id));
    if (stored) {
      try {
        const parsedStored = JSON.parse(stored) as Record<string, boolean>;
        const merged: Record<string, boolean> = {};
        paths.forEach((p) => {
          merged[p] = parsedStored[p] ?? false;
        });
        setExpandedMap(merged);
        return;
      } catch {
        // fall through
      }
    }
    const collapsed: Record<string, boolean> = {};
    paths.forEach((p) => {
      collapsed[p] = false;
    });
    setExpandedMap(collapsed);
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    persistTemplates(next);
    setTemplateList(next);
    if (localStorage.getItem(LAST_KEY) === id) {
      localStorage.removeItem(LAST_KEY);
    }
    if (activeTemplateId === id) {
      setActiveTemplateId('');
    }
  };

  const moveTemplateToProject = (id: string, project: string) => {
    const normalized = project === NO_PROJECT ? '' : project;
    const next = templates.map((tpl) =>
      tpl.id === id
        ? {
            ...tpl,
            project: normalized,
          }
        : tpl,
    );
    persistTemplates(next);
    setTemplateList(next);
    if (activeTemplateId === id) {
      setProjectName(normalized);
    }
  };

  const updateField = (id: string, patch: Partial<FieldSetting>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const updateLoop = (id: string, count: number) => {
    setLoops((prev) => prev.map((l) => (l.id === id ? { ...l, count } : l)));
  };

  const adjustLoopCount = (id: string, delta: number) => {
    setLoops((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, count: Math.max(1, l.count + delta) } : l,
      ),
    );
  };

  const addLoopAt = (templatePath: string) => {
    if (!root) return;
    const loopId = normalizeLoopId(
      templatePath.startsWith('/') ? templatePath : `/${templatePath}`,
    );
    setLoops((prev) => {
      const existing = prev.find((l) => l.id === loopId);
      if (existing) {
        return prev.map((l) => (l.id === loopId ? { ...l, count: l.count + 1 } : l));
      }
      return prev.concat({ id: loopId, label: loopId, count: 2 });
    });
    setRoot((prev) =>
      prev ? applyLoopMarker(prev, `/${prev.tag}`, templatePath, loopId) : prev,
    );
    setExpandedMap((prev) => ({ ...prev, [templatePath]: true }));
  };

  const removeLoopAt = (templatePath: string) => {
    if (!root) return;
    const loopId = normalizeLoopId(
      templatePath.startsWith('/') ? templatePath : `/${templatePath}`,
    );
    setLoops((prev) => prev.filter((l) => l.id !== loopId));
    setRoot((prev) =>
      prev ? clearLoopMarker(prev, `/${prev.tag}`, templatePath) : prev,
    );
  };

  const updateRelation = (id: string, enabled: boolean) => {
    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  const loopCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const loop of loops) {
      map.set(loop.id, loop.count);
    }
    return map;
  }, [loops]);

  const fieldMap = useMemo(() => {
    const map = new Map<string, FieldSetting>();
    for (const field of fields) {
      map.set(field.id, field);
    }
    return map;
  }, [fields]);

  const getFieldEntry = (templatePath: string) =>
    fieldMap.get(templatePath) ?? fieldMap.get(stripLoopMarkers(templatePath));

  const nodeHasMatch = (node: XmlNode, path: string, query: string): boolean => {
    if (!query) return true;
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    if (templatePath.toLowerCase().includes(query)) return true;
    if (node.tag.toLowerCase().includes(query)) return true;
    if (node.attrs.some((attr) => attr.name.toLowerCase().includes(query))) return true;
    if (node.text && node.text.toLowerCase().includes(query)) return true;
    return node.children.some((child) =>
      nodeHasMatch(child, `${path}/${child.tag}${child.loopId ? '[]' : ''}`, query),
    );
  };

  const resolveValue = (
    templateId: string,
    fileIndex: number,
    loopIndexMap: Record<string, number>,
    cache: Map<string, string>,
  ): string => {
    const cacheKey = `${templateId}::${fileIndex}::${JSON.stringify(loopIndexMap)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    const rel = relationByDependent.get(templateId);
    if (rel) {
      const masterValue = resolveValue(rel.masterId, fileIndex, loopIndexMap, cache);
      const value = `${rel.prefix}${masterValue}${rel.suffix}`;
      cache.set(cacheKey, value);
      return value;
    }

    const field = fieldMap.get(templateId);
    if (!field) return '';

    const indexOffset = fileIndex + Object.values(loopIndexMap).reduce((a, b) => a + b, 0);
    let value = field.value;
    if (field.mode === 'fixed') {
      value = field.fixedValue;
    } else if (field.mode === 'increment') {
      if (field.kind === 'number') {
        const base = Number(field.value) || 0;
        value = String(base + field.step * indexOffset);
      } else if (field.kind === 'date') {
        const baseDate = new Date(field.value);
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + field.step * indexOffset);
        value = toIsoDate(next);
      }
    } else if (field.mode === 'random') {
      if (field.kind === 'number') {
        if (field.length > 0) {
          const digits = Math.max(1, Math.floor(field.length));
          let out = '';
          for (let i = 0; i < digits; i += 1) {
            out += Math.floor(Math.random() * 10).toString();
          }
          value = out;
        } else {
          const min = Math.min(field.min, field.max);
          const max = Math.max(field.min, field.max);
          const rand = Math.floor(min + Math.random() * (max - min + 1));
          value = String(rand);
        }
      } else if (field.kind === 'date') {
        const baseDate = new Date(field.value);
        const span = Math.max(1, field.dateSpanDays);
        const offset = Math.floor(Math.random() * span);
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + offset);
        value = toIsoDate(next);
      } else {
        const length = Math.max(4, field.length);
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = '';
        for (let i = 0; i < length; i += 1) {
          out += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        value = out;
      }
    }

    cache.set(cacheKey, value);
    return value;
  };

  const serializeNode = (
    node: XmlNode,
    path: string,
    fileIndex: number,
    loopIndexMap: Record<string, number>,
    cache: Map<string, string>,
  ): string => {
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    const attrs = node.attrs
      .map((attr) => {
        const attrId = `${templatePath}/@${attr.name}`;
        const field = getFieldEntry(attrId);
        const value = field
          ? resolveValue(field.id, fileIndex, loopIndexMap, cache)
          : attr.value;
        return ` ${attr.name}="${escapeXml(value)}"`;
      })
      .join('');

    if (node.children.length === 0) {
      const field = getFieldEntry(templatePath);
      const value = field
        ? resolveValue(field.id, fileIndex, loopIndexMap, cache)
        : node.text ?? '';
      return `<${node.tag}${attrs}>${escapeXml(value)}</${node.tag}>`;
    }

    const children = node.children
      .map((child) => {
        if (child.loopId) {
          const loopId = child.loopId;
          const count = loopCountMap.get(loopId) ?? 1;
          const pieces = [];
          for (let i = 0; i < count; i += 1) {
            const nextLoop = { ...loopIndexMap, [loopId]: i };
            pieces.push(
              serializeNode(
                child,
                `${path}/${child.tag}[${i}]`,
                fileIndex,
                nextLoop,
                cache,
              ),
            );
          }
          return pieces.join('');
        }
        return serializeNode(child, `${path}/${child.tag}`, fileIndex, loopIndexMap, cache);
      })
      .join('');

    return `<${node.tag}${attrs}>${children}</${node.tag}>`;
  };

  const generateZip = async () => {
    if (!root) return;
    const zip = new JSZip();
    const baseName = getBaseName(fileName || 'message');
    for (let i = 0; i < filesToGenerate; i += 1) {
      const cache = new Map<string, string>();
      const content = serializeNode(root, `/${root.tag}`, i, {}, cache);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${content}`;
      const fileLabel = `${baseName}_${i + 1}.xml`;
      zip.file(fileLabel, xml);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_generated.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Wygenerowano ZIP z ${filesToGenerate} plikami.`);
  };

  const renderFieldControls = (field: FieldSetting) => {
    const relation = relationByDependent.get(field.id);
    const locked = Boolean(relation);

    return (
      <div className="field-controls">
        <label>
          Tryb
          <select
            value={field.mode}
            disabled={locked}
            onChange={(e) =>
              updateField(field.id, {
                mode: e.target.value as FieldMode,
              })
            }
          >
            <option value="same">Bez zmian</option>
            <option value="fixed">Stała wartość</option>
            <option value="increment">Inkrementacja</option>
            <option value="random">Random</option>
          </select>
        </label>
        {field.mode === 'fixed' && (
          <label>
            Wartość
            <input
              className="input"
              value={field.fixedValue}
              disabled={locked}
              onChange={(e) => updateField(field.id, { fixedValue: e.target.value })}
            />
          </label>
        )}
        {field.mode === 'increment' && (
          <label>
            Skok
            <input
              type="number"
              className="input"
              value={field.step}
              disabled={locked}
              onChange={(e) => updateField(field.id, { step: Number(e.target.value) || 1 })}
            />
          </label>
        )}
        {field.mode === 'random' && field.kind === 'number' && (
          <label>
            Zakres
            <div className="split">
              <input
                type="number"
                className="input"
                value={field.min}
                disabled={locked}
                onChange={(e) => updateField(field.id, { min: Number(e.target.value) || 0 })}
              />
              <input
                type="number"
                className="input"
                value={field.max}
                disabled={locked}
                onChange={(e) => updateField(field.id, { max: Number(e.target.value) || 0 })}
              />
            </div>
          </label>
        )}
        {field.mode === 'random' && field.kind === 'number' && (
          <label>
            Liczba znaków
            <input
              type="number"
              className="input"
              value={field.length}
              disabled={locked}
              onChange={(e) => updateField(field.id, { length: Number(e.target.value) || 0 })}
            />
          </label>
        )}
        {field.mode === 'random' && field.kind === 'text' && (
          <label>
            Długość
            <input
              type="number"
              className="input"
              value={field.length}
              disabled={locked}
              onChange={(e) => updateField(field.id, { length: Number(e.target.value) || 6 })}
            />
          </label>
        )}
        {field.mode === 'random' && field.kind === 'date' && (
          <label>
            Zakres dni
            <input
              type="number"
              className="input"
              value={field.dateSpanDays}
              disabled={locked}
              onChange={(e) =>
                updateField(field.id, { dateSpanDays: Number(e.target.value) || 7 })
              }
            />
          </label>
        )}
      </div>
    );
  };

  const renderFieldBlock = (fieldId: string, label: string) => {
    const field = getFieldEntry(fieldId);
    if (!field) return null;
    const relation = relationByDependent.get(field.id);
    const relationKind = relationHighlight.get(field.id);
    return (
      <div className={`field-block${relationKind ? ` related ${relationKind}` : ''}`}>
        <div className="field-header">
          <div>
            <strong>{label}</strong>
            <span>Wartość bazowa: {field.value}</span>
          </div>
          {relation && <span className="chip">Powiązane z {relation.masterId}</span>}
        </div>
        {renderFieldControls(field)}
      </div>
    );
  };

  const renderNodeEditor = (node: XmlNode, path: string, depth = 0) => {
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    const indent = { marginLeft: `${depth * 18}px` };
    const loopBadge = node.loopId ? <span className="chip">Pętla</span> : null;
    const query = treeQuery.trim().toLowerCase();
    const queryActive = query.length > 0;
    const matches = nodeHasMatch(node, path, query);
    const hasChildren = node.children.length > 0;
    const loopKey = node.loopId ? normalizeLoopId(node.loopId) : '';
    const loopCount = loopKey ? loopCountMap.get(loopKey) ?? 1 : 1;

    if (queryActive && !matches) {
      return null;
    }

    const isExpanded = queryActive ? true : expandedMap[templatePath] ?? false;

    const tagLabel = queryActive
      ? highlightText(`&lt;${node.tag}&gt;`, query)
      : `&lt;${node.tag}&gt;`;
    const pathLabel = queryActive ? highlightText(templatePath, query) : templatePath;

    return (
      <div
        className={`tree-node${highlightPath === templatePath ? ' highlight' : ''}`}
        style={indent}
        key={`${templatePath}-${depth}`}
        data-path={templatePath}
      >
        <button
          type="button"
          className="tree-line"
          onClick={() =>
            setExpandedMap((prev) => {
              const next = { ...prev, [templatePath]: !isExpanded };
              if (activeTemplateId) {
                localStorage.setItem(getExpandedKey(activeTemplateId), JSON.stringify(next));
              }
              return next;
            })
          }
        >
          <span className="tree-toggle">{hasChildren ? (isExpanded ? '▾' : '▸') : '•'}</span>
          <strong dangerouslySetInnerHTML={{ __html: tagLabel }} />
          {loopBadge}
          <span
            className="tree-path"
            dangerouslySetInnerHTML={{ __html: pathLabel }}
          />
          <span className="tree-actions">
            {node.loopId ? (
              <>
                <button
                  type="button"
                  className="tree-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    adjustLoopCount(loopKey, 1);
                  }}
                >
                  +1
                </button>
                <button
                  type="button"
                  className="tree-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    adjustLoopCount(loopKey, -1);
                  }}
                >
                  -1
                </button>
                <button
                  type="button"
                  className="tree-action danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeLoopAt(templatePath);
                  }}
                >
                  Usuń pętlę
                </button>
                <span className="loop-count">x{loopCount}</span>
              </>
            ) : (
              <button
                type="button"
                className="tree-action"
                onClick={(event) => {
                  event.stopPropagation();
                  addLoopAt(templatePath);
                }}
              >
                Powiel
              </button>
            )}
          </span>
        </button>
        {isExpanded && (
          <div className="tree-content">
            {node.attrs.length > 0 && (
              <div className="tree-attrs">
                {node.attrs.map((attr) =>
                  renderFieldBlock(`${templatePath}/@${attr.name}`, `@${attr.name}`),
                )}
              </div>
            )}
            {node.children.length === 0 && node.text !== undefined && (
              <div className="tree-text">{renderFieldBlock(templatePath, 'Wartość pola')}</div>
            )}
            {node.children.map((child) => {
              const childLoopKey = child.loopId ? normalizeLoopId(child.loopId) : '';
              const childLoopCount = childLoopKey ? loopCountMap.get(childLoopKey) ?? 1 : 1;
              const childPath = `${path}/${child.tag}${child.loopId ? '[]' : ''}`;
              if (queryActive && !nodeHasMatch(child, childPath, query)) return null;
              return child.loopId && showLoopInstances ? (
                <div key={`${templatePath}/${child.tag}-instances`}>
                  {Array.from({ length: childLoopCount }).map((_, index) => (
                    <div
                      key={`${templatePath}/${child.tag}[${index}]`}
                      className="loop-instance"
                    >
                        <div className="loop-label">Iteracja {index + 1}</div>
                      {renderNodeEditor(child, `${path}/${child.tag}[${index}]`, depth + 1)}
                    </div>
                  ))}
                </div>
              ) : (
                renderNodeEditor(child, childPath, depth + 1)
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const expandAll = () => {
    setExpandedMap((prev) => {
      const next = Object.fromEntries(Object.keys(prev).map((key) => [key, true]));
      if (activeTemplateId) {
        localStorage.setItem(getExpandedKey(activeTemplateId), JSON.stringify(next));
      }
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedMap((prev) => {
      const next = Object.fromEntries(Object.keys(prev).map((key) => [key, false]));
      if (activeTemplateId) {
        localStorage.setItem(getExpandedKey(activeTemplateId), JSON.stringify(next));
      }
      return next;
    });
  };

  const expandPath = (templatePath: string) => {
    const path = stripLoopMarkers(templatePath);
    const parts = path.split('/');
    const keys: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const key = parts.slice(0, i + 1).join('/');
      keys.push(key);
    }
    setExpandedMap((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = true;
      });
      if (activeTemplateId) {
        localStorage.setItem(getExpandedKey(activeTemplateId), JSON.stringify(next));
      }
      return next;
    });
  };

  const focusPath = (templatePath: string) => {
    const normalized = stripLoopMarkers(templatePath.replace(/^\//, ''));
    expandPath(normalized);
    setHighlightPath(normalized);
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-path="${normalized}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const focusRelation = (masterId: string, dependentId: string) => {
    const masterPath = stripLoopMarkers(masterId);
    const dependentPath = stripLoopMarkers(dependentId);
    expandPath(masterPath);
    expandPath(dependentPath);
    setHighlightPath(masterPath);
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-path="${masterPath}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleEditToggle = () => {
    if (!editMode) {
      setEditedXml(xmlText);
      setXmlError('');
      setEditMode(true);
      return;
    }

    if (editedXml.trim() === xmlText.trim()) {
      setEditMode(false);
      return;
    }

    if (xmlError) {
      setStatus(xmlError);
      return;
    }

    const parsed = parseXml(editedXml);
    if ('error' in parsed) {
      setStatus(parsed.error);
      return;
    }
    setStatus('Zmiany zapisane.');
    setXmlText(editedXml);
    setRoot(parsed.root);
    setFields(parsed.fields);
    setLoops(parsed.loops);
    setRelations(parsed.relations);
    const paths: string[] = [];
    collectPaths(parsed.root, `/${parsed.root.tag}`, paths);
    const collapsed: Record<string, boolean> = {};
    paths.forEach((p) => {
      collapsed[p] = false;
    });
    setExpandedMap(collapsed);
    setShowLoopInstances(false);
    setEditMode(false);
  };

  const exportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates,
      projects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = BACKUP_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Zapisano backup JSON.');
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        templates?: TemplatePayload[];
        projects?: string[];
      };
      const nextTemplates = Array.isArray(parsed.templates) ? parsed.templates : [];
      const nextProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      persistTemplates(nextTemplates);
      persistProjects(nextProjects);
      setTemplateList(nextTemplates);
      setProjects(nextProjects);
      setProjectName('');
      setProjectFilter('');
      setActiveTemplateId('');
      localStorage.removeItem(LAST_KEY);
      setStatus('Zaimportowano backup JSON.');
    } catch {
      setStatus('Nie udało się zaimportować pliku JSON.');
    }
  };

  const visibleTemplates = templates
    .filter((tpl) => {
      if (!projectFilter) return true;
      const key = tpl.project?.trim() ? tpl.project.trim() : NO_PROJECT;
      return key === projectFilter;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const projectStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const tpl of templates) {
      const key = tpl.project?.trim() ? tpl.project.trim() : NO_PROJECT;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  const templatesByProject = useMemo(() => {
    const map = new Map<string, TemplatePayload[]>();
    for (const tpl of visibleTemplates) {
      const key = tpl.project?.trim() ? tpl.project.trim() : NO_PROJECT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tpl);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleTemplates]);

  const treeSuggestions = useMemo(() => {
    if (!root) return [];
    const paths: string[] = [];
    collectPaths(root, `/${root.tag}`, paths);
    const normalized = paths.map((p) => p.replace(/^\//, ''));
    return Array.from(new Set(normalized));
  }, [root]);

  const filteredSuggestions = useMemo(() => {
    const query = treeQuery.trim().toLowerCase();
    if (!query) return [];
    return treeSuggestions
      .filter((path) => path.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [treeQuery, treeSuggestions]);

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">MessageLab</p>
          <h1>Laboratorium plików testowych z XML</h1>
          <p className="sub">
            Wgraj XML, ustaw reguły, wykryj relacje i wygeneruj paczkę danych do testów.
          </p>
        </div>
        <div className="hero-actions">
          <label className="upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            Wczytaj XML
          </label>
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <strong>Drag & Drop</strong>
            <span>Upuść plik XML tutaj lub kliknij, aby wybrać</span>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-row">
          <div>
            <h2>Szablony</h2>
            <p>Zapisywane lokalnie w przeglądarce.</p>
          </div>
          <div className="panel-actions">
            <input
              className="input"
              value={templateName}
              placeholder="Nazwa szablonu"
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <select
              className="input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            >
              <option value="">Bez projektu</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
            <button className="button" onClick={saveTemplate} disabled={!root}>
              Zapisz
            </button>
          </div>
        </div>
        <div className="panel-row">
          <div className="panel-actions">
            <input
              className="input"
              value={newProject}
              placeholder="Nowy projekt"
              onChange={(e) => setNewProject(e.target.value)}
            />
            <button
              className="button ghost"
              onClick={() => {
                const trimmed = newProject.trim();
                if (!trimmed) return;
                if (!projects.includes(trimmed)) {
                  const updated = [...projects, trimmed].sort();
                  setProjects(updated);
                  persistProjects(updated);
                }
                setProjectName(trimmed);
                setNewProject('');
              }}
            >
              Dodaj projekt
            </button>
            <select
              className="input"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">Wszystkie projekty</option>
              <option value={NO_PROJECT}>Bez projektu</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="project-grid">
          <button
            className={`project-pill${projectFilter === '' ? ' active' : ''}`}
            onClick={() => setProjectFilter('')}
            type="button"
          >
            Wszystkie ({templates.length})
          </button>
          {projectStats.map(([project, count]) => (
            <button
              key={project}
              className={`project-pill${projectFilter === project ? ' active' : ''}`}
              onClick={() => setProjectFilter(project)}
              type="button"
            >
              {project === NO_PROJECT ? 'Bez projektu' : project} ({count})
            </button>
          ))}
        </div>
        {templatesByProject.length === 0 && <p className="muted">Brak zapisanych szablonów.</p>}
        <div className="project-accordion">
          {templatesByProject.map(([project, items]) => {
            const isOpen =
              expandedProjects[project] ?? (projectFilter ? project === projectFilter : false);
            return (
              <div className="project-section" key={project}>
                <button
                  type="button"
                  className="project-header"
                  onClick={() =>
                    setExpandedProjects((prev) => ({
                      ...prev,
                      [project]: !isOpen,
                    }))
                  }
                >
                  <span className="project-toggle">{isOpen ? '▾' : '▸'}</span>
                  <strong>{project === NO_PROJECT ? 'Bez projektu' : project}</strong>
                  <span className="project-count">{items.length} szablonów</span>
                </button>
                {isOpen && (
                  <div className="template-grid">
                    {items.map((tpl) => (
                      <div className="template-card" key={tpl.id}>
                        <div className="template-meta">
                          <strong>{tpl.name}</strong>
                          <span>{tpl.fileName}</span>
                        </div>
                        <div className="template-actions">
                          <select
                            className="input compact"
                            value={tpl.project?.trim() ? tpl.project : NO_PROJECT}
                            onChange={(e) => moveTemplateToProject(tpl.id, e.target.value)}
                          >
                            <option value={NO_PROJECT}>Bez projektu</option>
                            {projects.map((projectOption) => (
                              <option key={projectOption} value={projectOption}>
                                {projectOption}
                              </option>
                            ))}
                          </select>
                          <div className="row-actions compact">
                            <button className="button ghost" onClick={() => loadTemplate(tpl)}>
                              Wczytaj
                            </button>
                            <button
                              className="button danger"
                              onClick={() => deleteTemplate(tpl.id)}
                            >
                              Usuń
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {root && (
        <section className="panel">
          <div className="panel-row">
            <div className="panel-title">
              <h2>Struktura i pola</h2>
              {fileName && <span className="file-chip">Plik: {fileName}</span>}
            </div>
            <div className="panel-actions">
              <div className="search-wrap" ref={searchWrapRef}>
                <input
                  className="input search"
                  placeholder="Szukaj w strukturze..."
                  value={treeQuery}
                  onChange={(e) => {
                    setTreeQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  disabled={editMode}
                />
                {showSuggestions && filteredSuggestions.length > 0 && !editMode && (
                  <div className="search-suggest">
                    {filteredSuggestions.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className="suggest-item"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setTreeQuery(item);
                          setShowSuggestions(false);
                          focusPath(item);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {treeQuery && (
                <button
                  className="button ghost"
                  onClick={() => {
                    setTreeQuery('');
                    setShowSuggestions(false);
                  }}
                  disabled={editMode}
                >
                  Wyczyść
                </button>
              )}
              <button
                className="button ghost"
                onClick={() => setShowLoopInstances((prev) => !prev)}
                disabled={editMode}
              >
                {showLoopInstances ? 'Zwiń iteracje' : 'Rozwiń iteracje'}
              </button>
              <button className="button ghost" onClick={expandAll} disabled={editMode}>
                Rozwiń wszystko
              </button>
              <button className="button ghost" onClick={collapseAll} disabled={editMode}>
                Zwiń wszystko
              </button>
              {editMode && (
                <button
                  className="button ghost"
                  onClick={() => {
                    setEditedXml(xmlText);
                    setXmlError('');
                  }}
                >
                  Cofnij zmiany
                </button>
              )}
              <button className="button" onClick={handleEditToggle}>
                {editMode
                  ? editedXml.trim() === xmlText.trim()
                    ? 'Zamknij'
                    : 'Zapisz'
                  : 'Edytuj'}
              </button>
            </div>
          </div>
          {editMode ? (
            <div className="xml-editor">
              <div
                className="xml-gutter"
                ref={xmlGutterRef}
                aria-hidden="true"
              >
                {Array.from({ length: editedXml.split('\n').length }).map((_, index) => (
                  <div key={`line-${index + 1}`} className="xml-line">
                    {index + 1}
                  </div>
                ))}
              </div>
              <div className="xml-layer">
                <textarea
                  ref={xmlInputRef}
                  className="xml-input"
                  value={editedXml}
                  onChange={(e) => setEditedXml(e.target.value)}
                  onScroll={(e) => {
                    if (xmlPreviewRef.current) {
                      xmlPreviewRef.current.scrollTop = e.currentTarget.scrollTop;
                      xmlPreviewRef.current.scrollLeft = e.currentTarget.scrollLeft;
                    }
                    if (xmlGutterRef.current) {
                      xmlGutterRef.current.scrollTop = e.currentTarget.scrollTop;
                    }
                  }}
                  spellCheck={false}
                  wrap="off"
                />
                <pre
                  ref={xmlPreviewRef}
                  className="xml-code"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: highlightXml(editedXml) }}
                />
              </div>
              {xmlError && <div className="xml-error">{xmlError}</div>}
            </div>
          ) : (
            <div className="tree">{renderNodeEditor(root, `/${root.tag}`)}</div>
          )}
        </section>
      )}

      {root && (
        <section className="panel grid">
          <div className="panel">
            <h2>Pętle</h2>
            {loops.length === 0 && <p className="muted">Brak powtarzających się sekcji.</p>}
            {loops.map((loop) => (
              <div className="field-row" key={loop.id}>
                <label>{loop.label}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={loop.count}
                  onChange={(e) => updateLoop(loop.id, Number(e.target.value) || 1)}
                />
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>Relacje</h2>
            {relations.length === 0 && <p className="muted">Brak wykrytych relacji.</p>}
            {relations.map((rel) => (
              <div
                className="relation"
                key={rel.id}
                role="button"
                tabIndex={0}
                onClick={() => focusRelation(rel.masterId, rel.dependentId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    focusRelation(rel.masterId, rel.dependentId);
                  }
                }}
              >
                <div>
                  <strong>{rel.masterId}</strong>
                  <span>→ {rel.dependentId}</span>
                </div>
                <label className="switch" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={rel.enabled}
                    onChange={(e) => updateRelation(rel.id, e.target.checked)}
                  />
                  <span>Powiązane</span>
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      {root && (
        <section className="panel">
          <h2>Generowanie</h2>
          <div className="field-row start">
            <label>Liczba plików</label>
            <input
              type="number"
              min={1}
              className="input"
              value={filesToGenerate}
              onChange={(e) => setFilesToGenerate(Number(e.target.value) || 1)}
            />
          </div>
          <button className="button primary" onClick={() => void generateZip()}>
            Pobierz ZIP
          </button>
          {status && <p className="status">{status}</p>}
          <div className="summary">
            <h3>Podsumowanie zmian</h3>
            {fields.filter((field) => field.mode !== 'same').length === 0 && (
              <p className="muted">Brak wybranych zmian.</p>
            )}
              {fields
                .filter((field) => field.mode !== 'same')
                .map((field) => (
                  <div className="summary-row" key={field.id}>
                    <strong>{field.label}</strong>
                    <div className="summary-meta">
                      <span>
                        {field.mode === 'fixed' && `Stała wartość: ${field.fixedValue}`}
                        {field.mode === 'increment' && `Inkrementacja: +${field.step}`}
                        {field.mode === 'random' && field.kind === 'number' && (
                          <>
                            Random liczby
                            {field.length > 0
                              ? ` (${field.length} cyfr)`
                              : ` (${field.min}-${field.max})`}
                          </>
                        )}
                        {field.mode === 'random' && field.kind === 'text' && (
                          <>Random tekst ({field.length} znaków)</>
                        )}
                        {field.mode === 'random' && field.kind === 'date' && (
                          <>Random data (+{field.dateSpanDays} dni)</>
                        )}
                      </span>
                      <button
                        type="button"
                        className="summary-remove"
                        onClick={() => updateField(field.id, { mode: 'same' })}
                        title="Usuń zmianę"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        </section>
      )}

      <section className="panel backup">
        <div>
          <h2>Backup</h2>
          <p>Eksportuj lub zaimportuj wszystkie projekty i interfejsy.</p>
        </div>
        <div className="panel-actions">
          <button className="button ghost" onClick={exportBackup}>
            Eksport JSON
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importBackup(file);
            }}
          />
          <button
            className="button"
            onClick={() => backupInputRef.current?.click()}
          >
            Import JSON
          </button>
        </div>
      </section>

      <footer className="footer">© 2026 Adrian Sarczyński</footer>
    </div>
  );
};

export default App;
