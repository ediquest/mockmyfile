import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import type { DataFormat, FieldSetting, LoopSetting, ParseResult, Relation, StatusMessage, XmlNode } from './core/types';
import { parseXml } from './core/xml/parse';
import { parseJson } from './core/json/parse';
import { parseCsv, type CsvParseResult } from './core/csv/parse';
import {
  deletePresetForTemplate,
  getPresetsForTemplate,
  getPresetsMap,
  savePresetForTemplate,
  updatePresetForTemplate,
  type Preset,
} from './core/presets';
import { applyLoopMarker, clearLoopMarker } from './core/xml/tree';
import { normalizeLoopId } from './core/templates';
import { BACKUP_FILE_NAME } from './core/constants';
import { clearLastId, persistProjects, persistTemplates } from './core/storage';
import UploadHero from './features/upload/UploadHero';
import TemplatesPanel from './features/templates/TemplatesPanel';
import TreePanel from './features/tree/TreePanel';
import LoopsPanel from './features/loops/LoopsPanel';
import RelationsPanel from './features/relations/RelationsPanel';
import GeneratePanel from './features/generate/GeneratePanel';
import BackupPanel from './features/backup/BackupPanel';
import useXmlEditor from './features/editor/useXmlEditor';
import useTemplates from './features/templates/useTemplates';
import useTree from './features/tree/useTree';
import useGenerate from './features/generate/useGenerate';
import { useI18n } from './i18n/I18nProvider';

const App = () => {
  const { lang, setLang, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [xmlText, setXmlText] = useState('');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<DataFormat>('xml');
  const [csvDelimiter, setCsvDelimiter] = useState(';');
  const [root, setRoot] = useState<XmlNode | null>(null);
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [loops, setLoops] = useState<LoopSetting[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [filesToGenerate, setFilesToGenerate] = useState(10);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [showLoopInstances, setShowLoopInstances] = useState(false);
  const [presetsVersion, setPresetsVersion] = useState(0);
  const pendingPresetRef = useRef<{ templateId: string; preset: Preset } | null>(null);

  const updateField = (id: string, patch: Partial<FieldSetting>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const updateLoop = (id: string, count: number) => {
    setLoops((prev) => prev.map((l) => (l.id === id ? { ...l, count } : l)));
  };

  const adjustLoopCount = (id: string, delta: number) => {
    setLoops((prev) =>
      prev.map((l) => (l.id === id ? { ...l, count: Math.max(1, l.count + delta) } : l)),
    );
  };

  const addLoopAt = (templatePath: string) => {
    if (!root) return;
    if (format !== 'xml') return;
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
    if (format !== 'xml') return;
    const loopId = normalizeLoopId(
      templatePath.startsWith('/') ? templatePath : `/${templatePath}`,
    );
    setLoops((prev) => prev.filter((l) => l.id !== loopId));
    setRoot((prev) => prev ? clearLoopMarker(prev, `/${prev.tag}`, templatePath) : prev);
  };

  const updateRelation = (id: string, enabled: boolean) => {
    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  const {
    editMode,
    editedXml,
    setEditedXml,
    xmlError,
    setXmlError,
    handleEditToggle,
    xmlInputRef,
    xmlPreviewRef,
    xmlGutterRef,
  } = useXmlEditor({
    format,
    xmlText,
    setXmlText,
    setRoot,
    setFields,
    setLoops,
    setRelations,
    setStatus,
    setExpandedMap,
    setShowLoopInstances,
    setCsvDelimiter,
  });

  const templates = useTemplates({
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
  });

  const tree = useTree({
    format,
    root,
    fields,
    loops,
    relations,
    activeTemplateId: templates.activeTemplateId,
    expandedMap,
    setExpandedMap,
    showLoopInstances,
    updateField,
    adjustLoopCount,
    addLoopAt,
    removeLoopAt,
  });

  const { generateZip } = useGenerate({
    format,
    csvDelimiter,
    root,
    fields,
    loops,
    relations,
    fileName,
    filesToGenerate,
    setStatus,
  });

  const detectFormat = (fileNameValue: string, text: string): DataFormat => {
    const lower = fileNameValue.toLowerCase();
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.xml')) return 'xml';
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('<')) return 'xml';
    if (trimmed.includes(';') || trimmed.includes(',') || trimmed.includes('\t')) return 'csv';
    return 'xml';
  };

  const isCsvParsed = (value: ParseResult | CsvParseResult): value is CsvParseResult & { ok: true } =>
    'delimiter' in value;

  const presetsMap = useMemo(() => getPresetsMap(), [presetsVersion]);

  const applyPreset = (preset: Preset) => {
    setFields((prev) => {
      const map = new Map(preset.fields.map((f) => [f.id, f]));
      return prev.map((field) => {
        const entry = map.get(field.id);
        return entry ? { ...field, ...entry } : field;
      });
    });
    setLoops((prev) => {
      const map = new Map(preset.loops.map((l) => [l.id, l.count]));
      return prev.map((loop) => {
        const count = map.get(loop.id);
        return count !== undefined ? { ...loop, count } : loop;
      });
    });
    setRelations((prev) => {
      const map = new Map(preset.relations.map((r) => [r.id, r]));
      return prev.map((rel) => {
        const entry = map.get(rel.id);
        return entry ? { ...rel, ...entry } : rel;
      });
    });
  };

  useEffect(() => {
    const pending = pendingPresetRef.current;
    if (!pending) return;
    if (templates.activeTemplateId !== pending.templateId) return;
    applyPreset(pending.preset);
    pendingPresetRef.current = null;
  }, [templates.activeTemplateId, fields, loops, relations]);

  useEffect(() => {
    const listFields = fields.filter((field) => field.mode === 'list' && field.listScope === 'global');
    if (listFields.length === 0) return;
    const getListLength = (value: string) =>
      value.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0).length;
    const getLoopIdForField = (fieldId: string) => {
      const lastIdx = fieldId.lastIndexOf('[]');
      if (lastIdx < 0) return null;
      const raw = fieldId.slice(0, lastIdx + 2);
      const candidates = [
        normalizeLoopId(`/${raw}`),
        normalizeLoopId(raw),
        `/${raw}`,
        raw,
      ];
      const match = loops.find((loop) => candidates.includes(loop.id));
      return match?.id ?? null;
    };
    const desired = new Map<string, number>();
    for (const field of listFields) {
      const loopId = getLoopIdForField(field.id);
      if (!loopId) continue;
      const listLength = getListLength(field.listText);
      const nextCount = listLength <= 0 ? 0 : Math.ceil(listLength / Math.max(1, filesToGenerate));
      const current = desired.get(loopId);
      if (current === undefined || nextCount > current) {
        desired.set(loopId, nextCount);
      }
    }
    if (desired.size === 0) return;
    setLoops((prev) => {
      let changed = false;
      const next = prev.map((loop) => {
        const target = desired.get(loop.id);
        if (target === undefined || target === loop.count) return loop;
        changed = true;
        return { ...loop, count: target };
      });
      return changed ? next : prev;
    });
  }, [fields, loops, filesToGenerate]);

  const handleSavePreset = (name: string, description: string) => {
    if (!templates.activeTemplateId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedDescription = description.trim();
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      name: trimmed,
      description: trimmedDescription,
      createdAt: new Date().toISOString(),
      fields: fields
        .filter((field) => field.mode !== 'same')
        .map((field) => ({
          id: field.id,
          mode: field.mode,
          fixedValue: field.fixedValue,
          listText: field.listText,
          listScope: field.listScope,
          step: field.step,
          min: field.min,
          max: field.max,
          length: field.length,
          dateSpanDays: field.dateSpanDays,
        })),
      loops: loops.map((loop) => ({ id: loop.id, count: loop.count })),
      relations: relations.map((rel) => ({
        id: rel.id,
        enabled: rel.enabled,
        prefix: rel.prefix,
        suffix: rel.suffix,
      })),
    };
    savePresetForTemplate(templates.activeTemplateId, preset);
    setPresetsVersion((v) => v + 1);
    setStatus({ key: 'presets.saved' });
  };

  const handleApplyPreset = (templateId: string, presetId: string) => {
    const presets = getPresetsForTemplate(templateId);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    if (templates.activeTemplateId !== templateId) {
      const tpl = templates.templates.find((t) => t.id === templateId);
      if (tpl) {
        templates.loadTemplate(tpl);
      }
      pendingPresetRef.current = { templateId, preset };
      return;
    }

    applyPreset(preset);
  };

  const handleDeletePreset = (templateId: string, presetId: string) => {
    deletePresetForTemplate(templateId, presetId);
    setPresetsVersion((v) => v + 1);
  };

  const handleUpdatePreset = (
    templateId: string,
    presetId: string,
    patch: { name?: string; description?: string },
  ) => {
    updatePresetForTemplate(templateId, presetId, patch);
    setPresetsVersion((v) => v + 1);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const nextFormat = detectFormat(file.name, text);
    const parsed = nextFormat === 'csv'
      ? parseCsv(text)
      : nextFormat === 'json'
        ? parseJson(text)
        : parseXml(text);
    if (!parsed.ok) {
      const detail = parsed.errorDetail ? ` (${parsed.errorDetail})` : '';
      setStatus({ text: `${t(parsed.errorKey)}${detail}` });
      return;
    }
    setStatus(null);
    setFormat(nextFormat);
    if (nextFormat === 'csv' && isCsvParsed(parsed)) {
      setCsvDelimiter(parsed.delimiter);
    }
    setXmlText(text);
    setEditedXml(text);
    setXmlError('');
    const nextDelimiter = nextFormat === 'csv' && isCsvParsed(parsed)
      ? parsed.delimiter
      : csvDelimiter;
    templates.syncFromUpload(
      file,
      nextFormat,
      nextDelimiter,
      parsed.root,
      parsed.fields,
      parsed.loops,
      parsed.relations,
    );
  };

  const exportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: templates.templates,
      projects: templates.projects,
      categories: templates.categoriesMap,
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
    setStatus({ key: 'status.backupExported' });
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        templates?: typeof templates.templates;
        projects?: string[];
        categories?: Record<string, string[]>;
      };
      const nextTemplates = Array.isArray(parsed.templates)
        ? parsed.templates.map((tpl) => ({
            ...tpl,
            description: tpl.description ?? '',
            category: tpl.category ?? templates.defaultCategory,
          }))
        : [];
      const nextProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      persistTemplates(nextTemplates);
      persistProjects(nextProjects);
      templates.setCategoriesFromImport(parsed.categories ?? {});
      templates.setTemplateList(nextTemplates);
      templates.setProjects(nextProjects);
      templates.setProjectName('');
      templates.setProjectFilter('');
      templates.setActiveTemplateId('');
      clearLastId();
      setStatus({ key: 'status.backupImported' });
    } catch {
      setStatus({ key: 'status.backupImportFailed' });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!tree.searchWrapRef.current) return;
      if (!tree.searchWrapRef.current.contains(event.target as Node)) {
        tree.setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tree.searchWrapRef, tree.setShowSuggestions]);

  return (
    <div className="app">
      <div className="lang-switch">
        <label htmlFor="lang-select">{t('language.label')}</label>
        <select
          id="lang-select"
          className="input compact"
          value={lang}
          onChange={(e) => setLang(e.target.value === 'en' ? 'en' : 'pl')}
        >
          <option value="pl">{t('language.polish')}</option>
          <option value="en">{t('language.english')}</option>
        </select>
      </div>
      <UploadHero fileInputRef={fileInputRef} onFile={(file) => void handleFile(file)} />
      {!root && status && (
        <p className="status">
          {'key' in status ? t(status.key as never, status.params as never) : status.text}
        </p>
      )}

      <TemplatesPanel
        templateName={templates.templateName}
        setTemplateName={templates.setTemplateName}
        projectName={templates.projectName}
        setProjectName={templates.setProjectName}
        projects={templates.projects}
        newProject={templates.newProject}
        setNewProject={templates.setNewProject}
        projectFilter={templates.projectFilter}
        setProjectFilter={templates.setProjectFilter}
        projectStats={templates.projectStats}
        templatesByProject={templates.templatesByProject}
        expandedProjects={templates.expandedProjects}
        setExpandedProjects={templates.setExpandedProjects}
        onSaveTemplate={templates.saveTemplate}
        onLoadTemplate={templates.loadTemplate}
        onRenameTemplate={templates.updateTemplateMeta}
        onDownloadTemplate={(tpl) => {
          const fileFormat = tpl.format ?? 'xml';
          const mime =
            fileFormat === 'json' ? 'application/json' : fileFormat === 'csv' ? 'text/csv' : 'application/xml';
          const ext = fileFormat === 'json' ? 'json' : fileFormat === 'csv' ? 'csv' : 'xml';
          const blob = new Blob([tpl.xmlText], { type: mime });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = tpl.fileName || `${tpl.name}.${ext}`;
          link.click();
          URL.revokeObjectURL(url);
        }}
        onDeleteTemplate={templates.deleteTemplate}
        presetsByTemplate={presetsMap}
        onApplyPreset={handleApplyPreset}
        onDeletePreset={handleDeletePreset}
        onUpdatePreset={handleUpdatePreset}
        onAddProject={templates.addProject}
        onDeleteProject={templates.deleteProject}
        onRenameProject={templates.renameProject}
        onAddCategory={templates.addCategory}
        onRenameCategory={templates.renameCategory}
        onDeleteCategory={templates.deleteCategory}
        defaultCategory={templates.defaultCategory}
        hasRoot={!!root}
        templatesCount={templates.templates.length}
      />

      {root && (
        <TreePanel
          format={format}
          root={root}
          fileName={fileName}
          treeQuery={tree.treeQuery}
          setTreeQuery={tree.setTreeQuery}
          showSuggestions={tree.showSuggestions}
          setShowSuggestions={tree.setShowSuggestions}
          filteredSuggestions={tree.filteredSuggestions}
          focusPath={tree.focusPath}
          editMode={editMode}
          showLoopInstances={showLoopInstances}
          setShowLoopInstances={setShowLoopInstances}
          expandAll={tree.expandAll}
          collapseAll={tree.collapseAll}
          handleEditToggle={handleEditToggle}
          editedXml={editedXml}
          setEditedXml={setEditedXml}
          xmlText={xmlText}
          xmlError={xmlError}
          xmlInputRef={xmlInputRef}
          xmlPreviewRef={xmlPreviewRef}
          xmlGutterRef={xmlGutterRef}
          searchWrapRef={tree.searchWrapRef}
          renderNodeEditor={tree.renderNodeEditor}
        />
      )}

      {root && (
        <section className="panel grid">
          <RelationsPanel
            relations={relations}
            updateRelation={updateRelation}
            focusRelation={tree.focusRelation}
          />
          <LoopsPanel loops={loops} updateLoop={updateLoop} focusLoop={tree.focusLoop} />
        </section>
      )}

      {root && (
        <GeneratePanel
          filesToGenerate={filesToGenerate}
          setFilesToGenerate={setFilesToGenerate}
          generateZip={generateZip}
          status={status}
          fields={fields}
          updateField={updateField}
          presets={templates.activeTemplateId ? presetsMap[templates.activeTemplateId] ?? [] : []}
          canSavePreset={Boolean(templates.activeTemplateId)}
          onSavePreset={handleSavePreset}
          onApplyPreset={(presetId) => {
            if (!templates.activeTemplateId) return;
            handleApplyPreset(templates.activeTemplateId, presetId);
          }}
          onDeletePreset={(presetId) => {
            if (!templates.activeTemplateId) return;
            handleDeletePreset(templates.activeTemplateId, presetId);
          }}
        />
      )}

      <BackupPanel
        backupInputRef={backupInputRef}
        exportBackup={exportBackup}
        importBackup={importBackup}
      />

      <footer className="footer">{t('footer.credit')}</footer>
    </div>
  );
};

export default App;





















