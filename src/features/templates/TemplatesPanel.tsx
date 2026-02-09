import type { Dispatch, SetStateAction } from 'react';
import { NO_PROJECT } from '../../core/constants';
import type { TemplatePayload } from '../../core/types';

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
  templatesByProject: [string, TemplatePayload[]][];
  expandedProjects: Record<string, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
  onSaveTemplate: () => void;
  onLoadTemplate: (tpl: TemplatePayload) => void;
  onDeleteTemplate: (id: string) => void;
  onMoveTemplateToProject: (id: string, project: string) => void;
  onAddProject: (project: string) => void;
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
  onDeleteTemplate,
  onMoveTemplateToProject,
  onAddProject,
  hasRoot,
  templatesCount,
}: TemplatesPanelProps) => (
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
      {templatesByProject.map(([project, items]) => {
        const isOpen = expandedProjects[project] ??
          (projectFilter ? project === projectFilter : false);
        return (
          <div className="project-section" key={project}>
            <button
              type="button"
              className="project-header"
              onClick={() =>
                setExpandedProjects((prev) => ({
                  ...prev,
                  [project]: !isOpen,
                }))}
            >
              <span className="project-toggle">{isOpen ? '-' : '+'}</span>
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
                        onChange={(e) => onMoveTemplateToProject(tpl.id, e.target.value)}
                      >
                        <option value={NO_PROJECT}>Bez projektu</option>
                        {projects.map((projectOption) => (
                          <option key={projectOption} value={projectOption}>
                            {projectOption}
                          </option>
                        ))}
                      </select>
                      <div className="row-actions compact">
                        <button className="button ghost" onClick={() => onLoadTemplate(tpl)}>
                          Wczytaj
                        </button>
                        <button
                          className="button danger"
                          onClick={() => onDeleteTemplate(tpl.id)}
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
);

export default TemplatesPanel;





