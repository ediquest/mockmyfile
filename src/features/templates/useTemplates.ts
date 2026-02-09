import { useEffect, useMemo, useState } from 'react';
import type {
  FieldSetting,
  LoopSetting,
  Relation,
  TemplatePayload,
  XmlNode,
} from '../../core/types';
import { NO_PROJECT } from '../../core/constants';
import {
  clearLastId,
  getExpandedKey,
  getLastId,
  getProjects,
  getTemplates,
  persistLastId,
  persistProjects,
  persistTemplates,
} from '../../core/storage';
import { normalizeRelation } from '../../core/relations';
import { parseXml } from '../../core/xml/parse';
import { collectPaths } from '../../core/xml/tree';
import { getBaseName, normalizeFieldSetting } from '../../core/templates';

export type UseTemplatesArgs = {
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

const buildCollapsedMap = (root: XmlNode) => {
  const paths: string[] = [];
  collectPaths(root, `/${root.tag}`, paths);
  const collapsed: Record<string, boolean> = {};
  paths.forEach((p) => {
    collapsed[p] = false;
  });
  return collapsed;
};

const useTemplates = ({
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
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplateList] = useState<TemplatePayload[]>(getTemplates());
  const [projects, setProjects] = useState<string[]>(getProjects());
  const [projectName, setProjectName] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [newProject, setNewProject] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');

  useEffect(() => {
    const lastId = getLastId();
    if (!lastId) return;
    const found = templates.find((t) => t.id === lastId);
    if (found) {
      loadTemplate(found);
    }
  }, []);

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
    persistLastId(id);
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
    if (!parsed.ok) {
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
    setExpandedMap(buildCollapsedMap(parsed.root));
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

  const addProject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!projects.includes(trimmed)) {
      const updated = [...projects, trimmed].sort();
      setProjects(updated);
      persistProjects(updated);
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

  const syncFromUpload = (file: File, parsedRoot: XmlNode, nextFields: FieldSetting[], nextLoops: LoopSetting[], nextRelations: Relation[]) => {
    setFileName(file.name);
    setRoot(parsedRoot);
    setFields(nextFields);
    setLoops(nextLoops);
    setRelations(nextRelations);
    setTemplateName(getBaseName(file.name));
    setActiveTemplateId('');
    setExpandedMap(buildCollapsedMap(parsedRoot));
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
    addProject,
    templatesByProject,
    projectStats,
    visibleTemplates,
    syncFromUpload,
  };
};

export default useTemplates;


