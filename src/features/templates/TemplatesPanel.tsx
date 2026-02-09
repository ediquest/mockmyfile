import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { NO_PROJECT } from '../../core/constants';
import type { TemplatePayload } from '../../core/types';
import type { TemplatesByProject } from './useTemplates';

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
  onAddProject: (project: string) => void;
  onAddCategory: (project: string, category: string) => void;
  onRenameCategory: (project: string, from: string, to: string) => void;
  onDeleteCategory: (project: string, category: string) => void;
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
  onAddProject,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  defaultCategory,
  hasRoot,
  templatesCount,
}: TemplatesPanelProps) => {
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
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{ project: string; category: string } | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ project: string; category: string } | null>(null);
  const originalRef = useRef<{ name: string; description: string; project: string; category: string } | null>(null);
  const lastSavedRef = useRef<{ name: string; description: string; project: string; category: string } | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

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
    if (editingId && originalRef.current) {
      onRenameTemplate(editingId, {
        name: originalRef.current.name,
        description: originalRef.current.description,
        project: originalRef.current.project,
        category: originalRef.current.category,
      });
    }
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

  return (
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
          <button className="button" onClick={onSaveTemplate} disabled={!hasRoot}>
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
              onAddProject(trimmed);
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
          Wszystkie ({templatesCount})
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
        {templatesByProject.map(({ project, categories }) => {
          const isOpen = expandedProjects[project] ??
            (projectFilter ? project === projectFilter : false);
          const totalCount = categories.reduce((sum, c) => sum + c.items.length, 0);
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
                <strong>{project === NO_PROJECT ? 'Bez projektu' : project}</strong>
                <span className="project-count">{totalCount} szablonów</span>
                <button
                  type="button"
                  className="button ghost compact"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAddCategoryProject(project);
                    setAddCategoryName('');
                  }}
                >
                  Dodaj kategorię
                </button>
              </div>
              {isOpen && (
                <div className="category-accordion">
                  {categories.map(({ category, items }) => {
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
                          <strong>{category}</strong>
                          <span className="project-count">{items.length}</span>
                          <div className="category-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title="Zmień nazwę"
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
                              title="Usuń kategorię"
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
                                        <span className="template-file">{tpl.fileName}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <strong>{tpl.name}</strong>
                                        <span className="template-file">{tpl.fileName}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="template-desc">
                                    {isEditing ? (
                                      <textarea
                                        className="input textarea"
                                        rows={2}
                                        value={draftDescription}
                                        placeholder="Opis interfejsu"
                                        onChange={(e) => setDraftDescription(e.target.value)}
                                      />
                                    ) : (
                                      <textarea
                                        className="input textarea read-only"
                                        rows={2}
                                        value={tpl.description ?? ''}
                                        placeholder="Opis interfejsu"
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
                                            <option value={NO_PROJECT}>Bez projektu</option>
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
                                                  {cat}
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
                                          Wczytaj
                                        </button>
                                        <button
                                          className="button ghost"
                                          onClick={() => onDownloadTemplate(tpl)}
                                        >
                                          Pobierz
                                        </button>
                                      </div>
                                    </div>
                                    <div className="template-actions-right">
                                      {isEditing ? (
                                        <button className="button ghost" onClick={cancelEdit}>
                                          Zamknij
                                        </button>
                                      ) : (
                                        <button className="button ghost" onClick={() => startEdit(tpl)}>
                                          Edytuj
                                        </button>
                                      )}
                                      {!isEditing && (
                                        <button
                                          className="button danger"
                                          onClick={() => setConfirmDeleteId(tpl.id)}
                                        >
                                          Usuń
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
      {addCategoryProject && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Dodaj kategorię</h3>
            <input
              className="input"
              value={addCategoryName}
              placeholder="Nazwa kategorii"
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
                Anuluj
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
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
      {renameCategoryInfo && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Zmień nazwę kategorii</h3>
            <input
              className="input"
              value={renameCategoryName}
              onChange={(e) => setRenameCategoryName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setRenameCategoryInfo(null)}>
                Anuluj
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
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
      {blockedDeleteInfo && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Nie można usunąć</h3>
            <p>Ta kategoria ma przypisane interfejsy. Usuń je lub przenieś do innej kategorii.</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setBlockedDeleteInfo(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteCategory && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Usunąć kategorię?</h3>
            <p>Ta operacja jest nieodwracalna.</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeleteCategory(null)}>
                Anuluj
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeleteCategory(confirmDeleteCategory.project, confirmDeleteCategory.category);
                  setConfirmDeleteCategory(null);
                }}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Usunąć szablon?</h3>
            <p>Ta operacja jest nieodwracalna.</p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setConfirmDeleteId(null)}>
                Anuluj
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onDeleteTemplate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TemplatesPanel;
