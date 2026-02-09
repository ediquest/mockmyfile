import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NO_PROJECT } from '../../core/constants';
import type { TemplatePayload } from '../../core/types';
import type { TemplatesByProject } from './useTemplates';
import { useI18n } from '../../i18n/I18nProvider';
import type { Preset } from '../../core/presets';

export type TemplatesPanelProps = {
  templateName: string;
  setTemplateName: (value: string) => void;
  projectName: string;
  setProjectName: (value: string) => void;
  projects: string[];
  newProject: string;
  setNewProject: (value: string) => void;
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  projectStats: [string, number][];
  templatesByProject: TemplatesByProject[];
  expandedProjects: Record<string, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
  onSaveTemplate: () => void;
  onLoadTemplate: (tpl: TemplatePayload) => void;
  onRenameTemplate: (
    id: string,
    patch: { name?: string; description?: string; project?: string; category?: string },
  ) => void;
  onDownloadTemplate: (tpl: TemplatePayload) => void;
  onDeleteTemplate: (id: string) => void;
  presetsByTemplate: Record<string, Preset[]>;
  onApplyPreset: (templateId: string, presetId: string) => void;
  onAddProject: (project: string) => void;
  onRenameProject: (from: string, to: string) => void;
  onAddCategory: (project: string, category: string) => void;
  onRenameCategory: (project: string, from: string, to: string) => void;
  onDeleteCategory: (project: string, category: string) => void;
  onDeleteProject: (project: string) => void;
  defaultCategory: string;
  hasRoot: boolean;
  templatesCount: number;
};

const TemplatesPanel = ({
  templateName,
  setTemplateName,
  projectName,
  setProjectName,
  projects,
  newProject,
  setNewProject,
  projectFilter,
  setProjectFilter,
  projectStats,
  templatesByProject,
  expandedProjects,
  setExpandedProjects,
  onSaveTemplate,
  onLoadTemplate,
  onRenameTemplate,
  onDownloadTemplate,
  onDeleteTemplate,
  presetsByTemplate,
  onApplyPreset,
  onAddProject,
  onRenameProject,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onDeleteProject,
  defaultCategory,
  hasRoot,
  templatesCount,
}: TemplatesPanelProps) => {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftProject, setDraftProject] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [addCategoryProject, setAddCategoryProject] = useState<string | null>(null);
  const [addCategoryName, setAddCategoryName] = useState('');
  const [renameCategoryInfo, setRenameCategoryInfo] = useState<{ project: string; category: string } | null>(null);
  const [renameCategoryName, setRenameCategoryName] = useState('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [renameProjectInfo, setRenameProjectInfo] = useState<string | null>(null);
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{ project: string; category: string } | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ project: string; category: string } | null>(null);
  const [blockedDeleteProject, setBlockedDeleteProject] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const [presetTemplateId, setPresetTemplateId] = useState<string | null>(null);
  const originalRef = useRef<{ name: string; description: string; project: string; category: string } | null>(null);
  const lastSavedRef = useRef<{ name: string; description: string; project: string; category: string } | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const renderModal = (children: ReactNode, onClose: () => void) =>
    createPortal(
      <div className="modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>,
      document.body,
    );

  const startEdit = (tpl: TemplatePayload) => {
    setEditingId(tpl.id);
    setDraftName(tpl.name);
    setDraftDescription(tpl.description ?? '');
    setDraftProject(tpl.project ?? '');
    setDraftCategory(tpl.category ?? defaultCategory);
    originalRef.current = {
      name: tpl.name,
      description: tpl.description ?? '',
      project: tpl.project ?? '',
      category: tpl.category ?? defaultCategory,
    };
    lastSavedRef.current = {
      name: tpl.name,
      description: tpl.description ?? '',
      project: tpl.project ?? '',
      category: tpl.category ?? defaultCategory,
    };
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName('');
    setDraftDescription('');
    setDraftProject('');
    setDraftCategory('');
    originalRef.current = null;
    lastSavedRef.current = null;
  };

  useEffect(() => {
    if (!editingId) return;
    if (!lastSavedRef.current) return;

    const next = {
      name: draftName.trim(),
      description: draftDescription,
      project: draftProject,
      category: draftCategory || defaultCategory,
    };
    const prev = lastSavedRef.current;
    if (
      next.name === prev.name &&
      next.description === prev.description &&
      next.project === prev.project &&
      next.category === prev.category
    ) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      onRenameTemplate(editingId, {
        name: next.name,
        description: next.description,
        project: next.project,
        category: next.category,
      });
      lastSavedRef.current = { ...next };
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editingId, draftName, draftDescription, draftProject, draftCategory, onRenameTemplate, defaultCategory]);

  const collapseAllProjects = () => setExpandedProjects({});

  const getCategoriesForProject = (project: string) => {
    const found = templatesByProject.find((p) => p.project === project);
    if (!found) return [defaultCategory];
    return found.categories.map((c) => c.category);
  };

  const labelCategory = (category: string) =>
    category === defaultCategory ? t('templates.defaultCategory') : category;

  return (
    <section className="panel">
      <div className="panel-row">
        <div>
          <h2>{t('templates.title')}</h2>
          <p>{t('templates.subtitle')}</p>
        </div>
        <div className="panel-actions">
          <input
            className="input"
            value={templateName}
            placeholder={t('templates.templateNamePlaceholder')}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <select
            className="input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          >
            <option value="">{t('templates.projectNone')}</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
          <button className="button" onClick={onSaveTemplate} disabled={!hasRoot}>
            {t('templates.save')}
          </button>
        </div>
      </div>
      <div className="panel-row">
        <div className="panel-actions">
          <input
            className="input"
            value={newProject}
            placeholder={t('templates.newProjectPlaceholder')}
            onChange={(e) => setNewProject(e.target.value)}
          />
          <button
            className="button ghost"
            onClick={() => {
              const trimmed = newProject.trim();
              if (!trimmed) return;
              onAddProject(trimmed);
              setProjectName(trimmed);
              setNewProject('');
            }}
          >
            {t('templates.addProject')}
          </button>
          <select
            className="input"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">{t('templates.filterAllLabel')}</option>
            <option value={NO_PROJECT}>{t('templates.projectNone')}</option>
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
          {t('templates.allPill')} ({templatesCount})
        </button>
        {projectStats.map(([project, count]) => (
          <button
            key={project}
            className={`project-pill${projectFilter === project ? ' active' : ''}`}
            onClick={() => setProjectFilter(project)}
            type="button"
          >
            {project === NO_PROJECT ? t('templates.projectNone') : project} ({count})
          </button>
        ))}
      </div>
      {templatesByProject.length === 0 && <p className="muted">{t('templates.noTemplates')}</p>}
      <div className="project-accordion">
        {templatesByProject.map(({ project, categories }) => {
          const visibleCategories = categories.filter((categoryGroup) => categoryGroup.items.length > 0);
          const isOpen = expandedProjects[project] ??
            (projectFilter ? project === projectFilter : false);
          const totalCount = categories.reduce((sum, c) => sum + c.items.length, 0);
          const isProjectDefault = project === NO_PROJECT;
          return (
            <div className="project-section" key={project}>
              <div
                className="project-header"
                role="button"
                tabIndex={0}
                onClick={() =>
                  setExpandedProjects((prev) => ({
                    ...prev,
                    [project]: !isOpen,
                  }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setExpandedProjects((prev) => ({
                      ...prev,
                      [project]: !isOpen,
                    }));
                  }
                }}
              >
                <span className="project-toggle">{isOpen ? '-' : '+'}</span>
                <strong>{project === NO_PROJECT ? t('templates.projectNone') : project}</strong>
                <span className="project-count">
                  {t('templates.projectCount', { count: totalCount })}
                </span>
                <div className="category-actions">
                  <button
                    type="button"
                    className="button ghost compact"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAddCategoryProject(project);
                      setAddCategoryName('');
                    }}
                  >
                    {t('templates.addCategory')}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('templates.renameProjectButtonTitle')}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isProjectDefault) return;
                      setRenameProjectInfo(project);
                      setRenameProjectName(project);
                    }}
                    disabled={isProjectDefault}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={t('templates.deleteProjectButtonTitle')}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isProjectDefault) return;
                      if (totalCount > 0) {
                        setBlockedDeleteProject(project);
                        return;
                      }
                      setConfirmDeleteProject(project);
                    }}
                    disabled={isProjectDefault}
                  >
                    🗑
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="category-accordion">
                  {visibleCategories.map(({ category, items }) => {
                    const categoryKey = `${project}::${category}`;
                    const isCategoryOpen = expandedCategories[categoryKey] ?? true;
                    const isDefaultCategory = category === defaultCategory;
                    return (
                      <div className="category-section" key={categoryKey}>
                        <div
                          className="category-header"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [categoryKey]: !isCategoryOpen,
                            }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedCategories((prev) => ({
                                ...prev,
                                [categoryKey]: !isCategoryOpen,
                              }));
                            }
                          }}
                        >
                          <span className="project-toggle">{isCategoryOpen ? '-' : '+'}</span>
                          <strong>{labelCategory(category)}</strong>
                          <span className="project-count">{items.length}</span>
                          <div className="category-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title={t('templates.renameCategoryButtonTitle')}
                              onClick={(event) => {
                                event.stopPropagation();
                                setRenameCategoryInfo({ project, category });
                                setRenameCategoryName(category);
                              }}
                              disabled={isDefaultCategory}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              title={t('templates.deleteCategoryButtonTitle')}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (items.length > 0) {
                                  setBlockedDeleteInfo({ project, category });
                                  return;
                                }
                                setConfirmDeleteCategory({ project, category });
                              }}
                              disabled={isDefaultCategory}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                        {isCategoryOpen && (
                          <div className="template-grid">
                            {items.map((tpl) => {
                              const isEditing = editingId === tpl.id;
                              const categoryList = getCategoriesForProject(project);
                              return (
                                <div className="template-card" key={tpl.id}>
                                  <div className="template-meta">
                                    {isEditing ? (
                                      <div className="template-meta-edit">
                                        <input
                                          className="input"
                                          value={draftName}
                                          onChange={(e) => setDraftName(e.target.value)}
                                        />
                                        <div className="template-meta-row">
                                          <span className="template-file">{tpl.fileName}</span>
                                          <span className="template-format">
                                            {(tpl.format ?? 'xml').toUpperCase()}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <strong>{tpl.name}</strong>
                                        <div className="template-meta-row">
                                          <span className="template-file">{tpl.fileName}</span>
                                          <span className="template-format">
                                            {(tpl.format ?? 'xml').toUpperCase()}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="template-desc">
                                    {isEditing ? (
                                        <textarea
                                          className="input textarea"
                                          rows={2}
                                          value={draftDescription}
                                          placeholder={t('templates.descriptionPlaceholder')}
                                          onChange={(e) => setDraftDescription(e.target.value)}
                                        />
                                    ) : (
                                      <textarea
                                        className="input textarea read-only"
                                        rows={2}
                                        value={tpl.description ?? ''}
                                        placeholder={t('templates.descriptionPlaceholder')}
                                        readOnly
                                      />
                                    )}
                                  </div>
                                  <div className="template-actions">
                                    <div className="template-actions-left">
                                      {isEditing && (
                                        <div className="edit-selects">
                                          <select
                                            className="input compact"
                                            value={draftProject?.trim() ? draftProject : NO_PROJECT}
                                            onChange={(e) => {
                                              const nextProject =
                                                e.target.value === NO_PROJECT ? '' : e.target.value;
                                              setDraftProject(nextProject);
                                              const available = getCategoriesForProject(
                                                nextProject || NO_PROJECT,
                                              );
                                              if (!available.includes(draftCategory)) {
                                                setDraftCategory(defaultCategory);
                                              }
                                            }}
                                          >
                                            <option value={NO_PROJECT}>
                                              {t('templates.projectNone')}
                                            </option>
                                            {projects.map((projectOption) => (
                                              <option key={projectOption} value={projectOption}>
                                                {projectOption}
                                              </option>
                                            ))}
                                          </select>
                                          <select
                                            className="input compact"
                                            value={draftCategory?.trim() ? draftCategory : defaultCategory}
                                            onChange={(e) => setDraftCategory(e.target.value)}
                                          >
                                            {Array.from(new Set([defaultCategory, ...categoryList])).map(
                                              (cat) => (
                                                <option key={cat} value={cat}>
                                                  {labelCategory(cat)}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                        </div>
                                      )}
                                      <div className="row-actions compact">
                                        <button
                                          className="button ghost"
                                          onClick={() => {
                                            onLoadTemplate(tpl);
                                            collapseAllProjects();
                                          }}
                                        >
                                          {t('templates.load')}
                                        </button>
                                        <button
                                          className="button ghost"
                                          onClick={() => setPresetTemplateId(tpl.id)}
                                        >
                                          {t('presets.manage')}
                                        </button>
                                        <button
                                          className="button ghost"
                                          onClick={() => onDownloadTemplate(tpl)}
                                        >
                                          {t('templates.download')}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="template-actions-right">
                                      {isEditing ? (
                                        <button className="button ghost" onClick={cancelEdit}>
                                          {t('templates.close')}
                                        </button>
                                      ) : (
                                        <button
                                          className="icon-btn"
                                          title={t('templates.edit')}
                                          onClick={() => startEdit(tpl)}
                                        >
                                          ✎
                                        </button>
                                      )}
                                      {!isEditing && (
                                        <button
                                          className="icon-btn danger"
                                          title={t('templates.delete')}
                                          onClick={() => setConfirmDeleteId(tpl.id)}
                                        >
                                          🗑
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {renameProjectInfo &&
        renderModal(
          <>
            <h3>{t('templates.renameProjectTitle')}</h3>
            <input
              className="input"
              value={renameProjectName}
              onChange={(e) => setRenameProjectName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setRenameProjectInfo(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button"
                onClick={() => {
                  const trimmed = renameProjectName.trim();
                  if (!trimmed) return;
                  onRenameProject(renameProjectInfo, trimmed);
                  setRenameProjectInfo(null);
                  setRenameProjectName('');
                }}
              >
                {t('templates.modalSave')}
              </button>
            </div>
          </>,
          () => setRenameProjectInfo(null),
        )}
      {addCategoryProject &&
        renderModal(
          <>
            <h3>{t('templates.categoryAddTitle')}</h3>
            <input
              className="input"
              value={addCategoryName}
              placeholder={t('templates.categoryNamePlaceholder')}
              autoFocus
              onChange={(e) => setAddCategoryName(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const trimmed = addCategoryName.trim();
                  if (!trimmed) return;
                  onAddCategory(addCategoryProject, trimmed);
                  setAddCategoryProject(null);
                  setAddCategoryName('');
                }
              }}
            />
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setAddCategoryProject(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button"
                onClick={() => {
                  const trimmed = addCategoryName.trim();
                  if (!trimmed) return;
                  onAddCategory(addCategoryProject, trimmed);
                  setAddCategoryProject(null);
                  setAddCategoryName('');
                }}
              >
                {t('templates.modalAdd')}
              </button>
            </div>
          </>,
          () => setAddCategoryProject(null),
        )}
      {renameCategoryInfo &&
        renderModal(
          <>
            <h3>{t('templates.renameCategoryTitle')}</h3>
            <input
              className="input"
              value={renameCategoryName}
              onChange={(e) => setRenameCategoryName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setRenameCategoryInfo(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button"
                onClick={() => {
                  const trimmed = renameCategoryName.trim();
                  if (!trimmed) return;
                  onRenameCategory(renameCategoryInfo.project, renameCategoryInfo.category, trimmed);
                  setRenameCategoryInfo(null);
                  setRenameCategoryName('');
                }}
              >
                {t('templates.modalSave')}
              </button>
            </div>
          </>,
          () => setRenameCategoryInfo(null),
        )}
      {blockedDeleteInfo &&
        renderModal(
          <>
            <h3>{t('templates.blockedDeleteTitle')}</h3>
            <p>{t('templates.blockedDeleteMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setBlockedDeleteInfo(null)}>
                {t('common.ok')}
              </button>
            </div>
          </>,
          () => setBlockedDeleteInfo(null),
        )}
      {confirmDeleteCategory &&
        renderModal(
          <>
            <h3>{t('templates.deleteCategoryConfirmTitle')}</h3>
            <p>{t('templates.deleteConfirmMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeleteCategory(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeleteCategory(confirmDeleteCategory.project, confirmDeleteCategory.category);
                  setConfirmDeleteCategory(null);
                }}
              >
                {t('templates.modalDelete')}
              </button>
            </div>
          </>,
          () => setConfirmDeleteCategory(null),
        )}
      {blockedDeleteProject &&
        renderModal(
          <>
            <h3>{t('templates.blockedDeleteTitle')}</h3>
            <p>{t('templates.blockedDeleteProjectMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setBlockedDeleteProject(null)}>
                {t('common.ok')}
              </button>
            </div>
          </>,
          () => setBlockedDeleteProject(null),
        )}
      {confirmDeleteProject &&
        renderModal(
          <>
            <h3>{t('templates.deleteProjectConfirmTitle')}</h3>
            <p>{t('templates.deleteConfirmMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeleteProject(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeleteProject(confirmDeleteProject);
                  setConfirmDeleteProject(null);
                }}
              >
                {t('templates.modalDelete')}
              </button>
            </div>
          </>,
          () => setConfirmDeleteProject(null),
        )}
      {confirmDeleteId &&
        renderModal(
          <>
            <h3>{t('templates.deleteTemplateConfirmTitle')}</h3>
            <p>{t('templates.deleteConfirmMessage')}</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeleteId(null)}>
                {t('templates.modalCancel')}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeleteTemplate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                {t('templates.modalDelete')}
              </button>
            </div>
          </>,
          () => setConfirmDeleteId(null),
        )}
      {presetTemplateId &&
        renderModal(
          <>
            <h3>{t('presets.title')}</h3>
            {(presetsByTemplate[presetTemplateId] ?? []).length === 0 && (
              <p className="muted">{t('presets.none')}</p>
            )}
            <div className="template-list">
              {(presetsByTemplate[presetTemplateId] ?? []).map((preset) => (
                <div key={preset.id} className="template-item">
                  <div>
                    <strong>{preset.name}</strong>
                    <span>{new Date(preset.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="row-actions compact">
                    <button
                      className="button ghost"
                      onClick={() => {
                        onApplyPreset(presetTemplateId, preset.id);
                        setPresetTemplateId(null);
                      }}
                    >
                      {t('presets.apply')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setPresetTemplateId(null)}>
                {t('templates.modalCancel')}
              </button>
            </div>
          </>,
          () => setPresetTemplateId(null),
        )}
    </section>
  );
};

export default TemplatesPanel;
