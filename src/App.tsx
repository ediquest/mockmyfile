import { useEffect, useRef, useState } from 'react';
import './App.css';
import type { DataFormat, FieldSetting, LoopSetting, Relation, XmlNode } from './core/types';
import { parseXml } from './core/xml/parse';
import { parseJson } from './core/json/parse';
import { parseCsv } from './core/csv/parse';
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
  const [status, setStatus] = useState('');
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [showLoopInstances, setShowLoopInstances] = useState(false);

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
      setStatus(`${t(parsed.errorKey)}${detail}`);
      return;
    }
    setStatus('');
    setFormat(nextFormat);
    if (nextFormat === 'csv' && 'delimiter' in parsed) {
      setCsvDelimiter(parsed.delimiter);
    }
    setXmlText(text);
    setEditedXml(text);
    setXmlError('');
    templates.syncFromUpload(
      file,
      nextFormat,
      nextFormat === 'csv' && 'delimiter' in parsed ? parsed.delimiter : csvDelimiter,
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
    setStatus(t('status.backupExported'));
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
      setStatus(t('status.backupImported'));
    } catch {
      setStatus(t('status.backupImportFailed'));
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
      {!root && status && <p className="status">{status}</p>}

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
          <LoopsPanel loops={loops} updateLoop={updateLoop} />
          <RelationsPanel
            relations={relations}
            updateRelation={updateRelation}
            focusRelation={tree.focusRelation}
          />
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













