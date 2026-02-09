import { useEffect, useMemo, useState } from 'react';
import type {
  DataFormat,
  FieldSetting,
  LoopSetting,
  Relation,
  TemplatePayload,
  XmlNode,
} from '../../core/types';
import { NO_PROJECT } from '../../core/constants';
import {
  clearLastId,
  getCategories,
  getExpandedKey,
  getLastId,
  getProjects,
  getTemplates,
  persistCategories,
  persistLastId,
  persistProjects,
  persistTemplates,
} from '../../core/storage';
import { normalizeRelation } from '../../core/relations';
import { useI18n } from '../../i18n/I18nProvider';
import { parseXml } from '../../core/xml/parse';
import { parseJson } from '../../core/json/parse';
import { parseCsv } from '../../core/csv/parse';
import { collectPaths } from '../../core/xml/tree';
import { collectJsonPaths } from '../../core/json/tree';
import { getBaseName, normalizeFieldSetting } from '../../core/templates';

const DEFAULT_CATEGORY = 'Ogólne';

export type TemplatesByProject = {
  project: string;
  categories: { category: string; items: TemplatePayload[] }[];
};

export type UseTemplatesArgs = {
  format: DataFormat;
  setFormat: (value: DataFormat) => void;
  csvDelimiter: string;
  setCsvDelimiter: (value: string) => void;
  root: XmlNode | null;
  xmlText: string;
  fields: FieldSetting[];
  loops: LoopSetting[];
  relations: Relation[];
  fileName: string;
  setRoot: (value: XmlNode | null) => void;
  setXmlText: (value: string) => void;
  setFields: (value: FieldSetting[]) => void;
  setLoops: (value: LoopSetting[]) => void;
  setRelations: (value: Relation[]) => void;
  setFileName: (value: string) => void;
  setStatus: (value: string) => void;
  setExpandedMap: (value: Record<string, boolean>) => void;
  setEditedXml: (value: string) => void;
  setXmlError: (value: string) => void;
};

const normalizeTemplates = (list: TemplatePayload[]) =>
  list.map((tpl) => ({
    ...tpl,
    description: tpl.description ?? '',
    category: tpl.category?.trim() ? tpl.category : DEFAULT_CATEGORY,
    format: tpl.format ?? 'xml',
    csvDelimiter: tpl.csvDelimiter ?? ';',
  }));

const normalizeCategoriesMap = (map: Record<string, string[]>) => {
  const next: Record<string, string[]> = {};
  Object.entries(map).forEach(([project, categories]) => {
    const unique = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    if (!unique.includes(DEFAULT_CATEGORY)) unique.unshift(DEFAULT_CATEGORY);
    next[project] = unique;
  });
  return next;
};

const buildCollapsedMap = (root: XmlNode, format: DataFormat) => {
  const paths: string[] = [];
  if (format === 'json' || format === 'csv') {
    collectJsonPaths(root, `/${root.tag}`, paths);
  } else {
    collectPaths(root, `/${root.tag}`, paths);
  }
  const collapsed: Record<string, boolean> = {};
  paths.forEach((p) => {
    collapsed[p] = false;
  });
  return collapsed;
};

const useTemplates = ({
  format,
  setFormat,
  csvDelimiter,
  setCsvDelimiter,
  root,
  xmlText,
  fields,
  loops,
  relations,
  fileName,
  setRoot,
  setXmlText,
  setFields,
  setLoops,
  setRelations,
  setFileName,
  setStatus,
  setExpandedMap,
  setEditedXml,
  setXmlError,
}: UseTemplatesArgs) => {
  const { t } = useI18n();
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplateList] = useState<TemplatePayload[]>(
    normalizeTemplates(getTemplates()),
  );
  const [projects, setProjects] = useState<string[]>(getProjects());
  const [projectName, setProjectName] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [newProject, setNewProject] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string[]>>(
    normalizeCategoriesMap(getCategories()),
  );

  useEffect(() => {
    const lastId = getLastId();
    if (!lastId) return;
    const found = templates.find((t) => t.id === lastId);
    if (found) {
      loadTemplate(found);
    }
  }, []);

  useEffect(() => {
    const fromTemplates: Record<string, string[]> = {};
    for (const tpl of templates) {
      const projectKey = tpl.project?.trim() ? tpl.project.trim() : NO_PROJECT;
      const categoryKey = tpl.category?.trim() ? tpl.category.trim() : DEFAULT_CATEGORY;
      if (!fromTemplates[projectKey]) fromTemplates[projectKey] = [];
      fromTemplates[projectKey].push(categoryKey);
    }
    const merged: Record<string, string[]> = { ...categoriesMap };
    Object.entries(fromTemplates).forEach(([project, cats]) => {
      const existing = merged[project] ?? [];
      merged[project] = Array.from(new Set([...existing, ...cats]));
    });
    const normalized = normalizeCategoriesMap(merged);
    const before = JSON.stringify(categoriesMap);
    const after = JSON.stringify(normalized);
    if (before !== after) {
      setCategoriesMap(normalized);
      persistCategories(normalized);
    }
  }, [templates]);

  const saveTemplate = () => {
    if (!root) return;
    const trimmedProject = projectName.trim();
    const id = templateName.trim() || `template-${Date.now()}`;
    const existing = templates.find((tpl) => tpl.id === id);
    const payload: TemplatePayload = {
      id,
      name: templateName.trim() || id,
      description: existing?.description ?? '',
      project: trimmedProject,
      category: existing?.category ?? DEFAULT_CATEGORY,
      xmlText,
      fields,
      loops,
      relations,
      fileName,
      format,
      csvDelimiter,
    };
    const next = templates.filter((t) => t.id !== id).concat(payload);
    persistTemplates(next);
    setTemplateList(next);
    persistLastId(id);
    setStatus(t('status.templateSaved'));
    if (trimmedProject && !projects.includes(trimmedProject)) {
      const updated = [...projects, trimmedProject].sort();
      setProjects(updated);
      persistProjects(updated);
    }
    if (trimmedProject) {
      addCategory(trimmedProject, existing?.category ?? DEFAULT_CATEGORY);
    }
  };

  const loadTemplate = (tpl: TemplatePayload) => {
    const normalized = {
      ...tpl,
      description: tpl.description ?? '',
      category: tpl.category?.trim() ? tpl.category : DEFAULT_CATEGORY,
      format: tpl.format ?? 'xml',
      csvDelimiter: tpl.csvDelimiter ?? ';',
    };
    persistLastId(normalized.id);
    setXmlText(normalized.xmlText);
    setEditedXml(normalized.xmlText);
    setXmlError('');
    setFileName(normalized.fileName);
    setFields(normalized.fields.map(normalizeFieldSetting));
    setLoops(normalized.loops);
    setRelations(normalized.relations.map(normalizeRelation));
    setTemplateName(normalized.name);
    setProjectName(normalized.project || '');
    setFormat(normalized.format);
    if (normalized.format === 'csv') {
      setCsvDelimiter(normalized.csvDelimiter);
    }
    const parsed = normalized.format === 'csv'
      ? parseCsv(normalized.xmlText, { delimiter: normalized.csvDelimiter })
      : normalized.format === 'json'
        ? parseJson(normalized.xmlText)
        : parseXml(normalized.xmlText);
    if (!parsed.ok) {
      const detail = parsed.errorDetail ? ` (${parsed.errorDetail})` : '';
      setStatus(`${t(parsed.errorKey)}${detail}`);
      return;
    }
    setRoot(parsed.root);
    setStatus(t('status.templateLoaded'));
    setActiveTemplateId(normalized.id);
    const paths: string[] = [];
    if (normalized.format === 'json' || normalized.format === 'csv') {
      collectJsonPaths(parsed.root, `/${parsed.root.tag}`, paths);
    } else {
      collectPaths(parsed.root, `/${parsed.root.tag}`, paths);
    }
    const stored = localStorage.getItem(getExpandedKey(normalized.id));
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
    setExpandedMap(buildCollapsedMap(parsed.root, normalized.format));
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    persistTemplates(next);
    setTemplateList(next);
    if (getLastId() === id) {
      clearLastId();
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

  const updateTemplateMeta = (
    id: string,
    patch: { name?: string; description?: string; project?: string; category?: string },
  ) => {
    const next = templates.map((tpl) =>
      tpl.id === id
        ? {
            ...tpl,
            name: patch.name?.trim() || tpl.name,
            description: patch.description ?? tpl.description ?? '',
            project: patch.project ?? tpl.project,
            category:
              patch.category?.trim() || tpl.category?.trim() || DEFAULT_CATEGORY,
          }
        : tpl,
    );
    persistTemplates(next);
    setTemplateList(next);
    if (activeTemplateId === id) {
      if (patch.name && patch.name.trim()) {
        setTemplateName(patch.name.trim());
      }
      if (patch.project !== undefined) {
        setProjectName(patch.project);
      }
    }
  };

  const addCategory = (project: string, category: string) => {
    const projectKey = project?.trim() ? project.trim() : NO_PROJECT;
    const trimmed = category.trim();
    if (!trimmed) return;
    const existing = categoriesMap[projectKey] ?? [DEFAULT_CATEGORY];
    if (existing.includes(trimmed)) return;
    const next = {
      ...categoriesMap,
      [projectKey]: normalizeCategoriesMap({ [projectKey]: [...existing, trimmed] })[projectKey],
    };
    setCategoriesMap(next);
    persistCategories(next);
  };

  const renameCategory = (project: string, from: string, to: string) => {
    const projectKey = project?.trim() ? project.trim() : NO_PROJECT;
    const nextName = to.trim();
    if (!nextName) return;
    if (from === DEFAULT_CATEGORY) return;

    const updatedTemplates = templates.map((tpl) =>
      tpl.project?.trim() === projectKey && tpl.category === from
        ? { ...tpl, category: nextName }
        : tpl,
    );
    persistTemplates(updatedTemplates);
    setTemplateList(updatedTemplates);

    const existing = categoriesMap[projectKey] ?? [DEFAULT_CATEGORY];
    const nextCategories = existing.map((c) => (c === from ? nextName : c));
    const next = {
      ...categoriesMap,
      [projectKey]: normalizeCategoriesMap({ [projectKey]: nextCategories })[projectKey],
    };
    setCategoriesMap(next);
    persistCategories(next);
  };

  const deleteCategory = (project: string, category: string) => {
    if (category === DEFAULT_CATEGORY) return;
    const projectKey = project?.trim() ? project.trim() : NO_PROJECT;
    const existing = categoriesMap[projectKey] ?? [DEFAULT_CATEGORY];
    const nextCategories = existing.filter((c) => c !== category);
    const next = {
      ...categoriesMap,
      [projectKey]: normalizeCategoriesMap({ [projectKey]: nextCategories })[projectKey],
    };
    setCategoriesMap(next);
    persistCategories(next);
  };

  const deleteProject = (project: string) => {
    const trimmed = project.trim();
    if (!trimmed) return;
    if (trimmed === NO_PROJECT) return;
    const hasTemplates = templates.some((tpl) => tpl.project?.trim() === trimmed);
    if (hasTemplates) return;

    const nextProjects = projects.filter((p) => p !== trimmed);
    setProjects(nextProjects);
    persistProjects(nextProjects);

    const nextCategories: Record<string, string[]> = { ...categoriesMap };
    if (nextCategories[trimmed]) {
      delete nextCategories[trimmed];
      setCategoriesMap(nextCategories);
      persistCategories(nextCategories);
    }

    if (projectFilter === trimmed) {
      setProjectFilter('');
    }
    if (projectName === trimmed) {
      setProjectName('');
    }
  };

  const renameProject = (from: string, to: string) => {
    const trimmed = to.trim();
    if (!trimmed) return;
    if (from === NO_PROJECT) return;
    if (from === trimmed) return;

    const nextProjects = projects.map((p) => (p === from ? trimmed : p));
    setProjects(nextProjects);
    persistProjects(nextProjects);

    const nextTemplates = templates.map((tpl) =>
      tpl.project === from ? { ...tpl, project: trimmed } : tpl,
    );
    persistTemplates(nextTemplates);
    setTemplateList(nextTemplates);

    const nextCategories: Record<string, string[]> = { ...categoriesMap };
    if (nextCategories[from]) {
      nextCategories[trimmed] = nextCategories[from];
      delete nextCategories[from];
      persistCategories(nextCategories);
      setCategoriesMap(nextCategories);
    }

    if (projectFilter === from) {
      setProjectFilter(trimmed);
    }
    if (projectName === from) {
      setProjectName(trimmed);
    }
  };

  const addProject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!projects.includes(trimmed)) {
      const updated = [...projects, trimmed].sort();
      setProjects(updated);
      persistProjects(updated);
    }
    addCategory(trimmed, DEFAULT_CATEGORY);
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
    const templateMap = new Map<string, Map<string, TemplatePayload[]>>();
    const projectKeys = new Set<string>();

    for (const tpl of visibleTemplates) {
      const projectKey = tpl.project?.trim() ? tpl.project.trim() : NO_PROJECT;
      const categoryKey = tpl.category?.trim() ? tpl.category.trim() : DEFAULT_CATEGORY;
      projectKeys.add(projectKey);
      if (!templateMap.has(projectKey)) templateMap.set(projectKey, new Map());
      const categoryMap = templateMap.get(projectKey)!;
      if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, []);
      categoryMap.get(categoryKey)!.push(tpl);
    }

    Object.keys(categoriesMap).forEach((key) => projectKeys.add(key));

    return Array.from(projectKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((project) => {
        const categoryMap = templateMap.get(project) ?? new Map();
        const categories = categoriesMap[project] ?? [DEFAULT_CATEGORY];
        const categoryEntries = categories.map((category) => ({
          category,
          items: categoryMap.get(category) ?? [],
        }));
        return {
          project,
          categories: categoryEntries,
        };
      });
  }, [visibleTemplates, categoriesMap]);

  const syncFromUpload = (
    file: File,
    nextFormat: DataFormat,
    nextDelimiter: string,
    parsedRoot: XmlNode,
    nextFields: FieldSetting[],
    nextLoops: LoopSetting[],
    nextRelations: Relation[],
  ) => {
    setFileName(file.name);
    setFormat(nextFormat);
    if (nextFormat === 'csv') {
      setCsvDelimiter(nextDelimiter);
    }
    setRoot(parsedRoot);
    setFields(nextFields);
    setLoops(nextLoops);
    setRelations(nextRelations);
    setTemplateName(getBaseName(file.name));
    setActiveTemplateId('');
    setExpandedMap(buildCollapsedMap(parsedRoot, nextFormat));
  };

  return {
    templateName,
    setTemplateName,
    templates,
    setTemplateList,
    projects,
    setProjects,
    projectName,
    setProjectName,
    projectFilter,
    setProjectFilter,
    newProject,
    setNewProject,
    expandedProjects,
    setExpandedProjects,
    activeTemplateId,
    setActiveTemplateId,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    moveTemplateToProject,
    updateTemplateMeta,
    addProject,
    addCategory,
    renameCategory,
    deleteCategory,
    deleteProject,
    renameProject,
    categoriesMap,
    templatesByProject,
    projectStats,
    visibleTemplates,
    syncFromUpload,
    defaultCategory: DEFAULT_CATEGORY,
  };
};

export default useTemplates;
