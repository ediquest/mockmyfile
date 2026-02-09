import { useMemo, useRef, useState } from 'react';
import type { FieldSetting, LoopSetting, Relation, XmlNode } from '../../core/types';
import { collectPaths } from '../../core/xml/tree';
import { MAX_SUGGESTIONS } from '../../core/constants';
import { highlightText } from '../../core/xml/highlight';
import { normalizeId, normalizeLoopId, stripLoopMarkers } from '../../core/templates';
import { getExpandedKey } from '../../core/storage';
import { useI18n } from '../../i18n/I18nProvider';

export type UseTreeArgs = {
  root: XmlNode | null;
  fields: FieldSetting[];
  loops: LoopSetting[];
  relations: Relation[];
  activeTemplateId: string;
  expandedMap: Record<string, boolean>;
  setExpandedMap: (value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  showLoopInstances: boolean;
  updateField: (id: string, patch: Partial<FieldSetting>) => void;
  adjustLoopCount: (id: string, delta: number) => void;
  addLoopAt: (templatePath: string) => void;
  removeLoopAt: (templatePath: string) => void;
};

const useTree = ({
  root,
  fields,
  loops,
  relations,
  activeTemplateId,
  expandedMap,
  setExpandedMap,
  showLoopInstances,
  updateField,
  adjustLoopCount,
  addLoopAt,
  removeLoopAt,
}: UseTreeArgs) => {
  const { t } = useI18n();

  const [highlightPath, setHighlightPath] = useState('');
  const [treeQuery, setTreeQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

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

    const treeSuggestions = useMemo(() => {
    if (!root) return [] as string[];
    const paths: string[] = [];
    collectPaths(root, `/${root.tag}`, paths);
    const normalized = paths.map((p) => p.replace(/^\//, ''));
    return Array.from(new Set(normalized));
  }, [root]);

  const filteredSuggestions = useMemo(() => {
    const query = treeQuery.trim().toLowerCase();
    if (!query) return [] as string[];
    return treeSuggestions
      .filter((path) => path.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [treeQuery, treeSuggestions]);
  const renderFieldControls = (field: FieldSetting) => {
    const relation = relationByDependent.get(field.id);
    const locked = Boolean(relation);

    return (
      <div className="field-controls">
        <label>
          {t('field.mode')}
          <select
            value={field.mode}
            disabled={locked}
            onChange={(e) =>
              updateField(field.id, {
                mode: e.target.value as FieldSetting['mode'],
              })
            }
          >
            <option value="same">{t('field.mode.same')}</option>
            <option value="fixed">{t('field.mode.fixed')}</option>
            <option value="increment">{t('field.mode.increment')}</option>
            <option value="random">{t('field.mode.random')}</option>
          </select>
        </label>
        {field.mode === 'fixed' && (
          <label>
            {t('field.value')}
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
            {t('field.step')}
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
            {t('field.range')}
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
            {t('field.lengthDigits')}
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
            {t('field.length')}
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
            {t('field.daysRange')}
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
            <span>{t('field.baseValue', { value: field.value })}</span>
          </div>
          {relation && (
            <span className="chip">{t('field.relatedTo', { master: relation.masterId })}</span>
          )}
        </div>
        {renderFieldControls(field)}
      </div>
    );
  };

  const renderNodeEditor = (node: XmlNode, path: string, depth = 0) => {
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    const indent = { marginLeft: `${depth * 18}px` };
    const loopBadge = node.loopId ? <span className="chip">{t('field.loop')}</span> : null;
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
        <div
          role="button"
          tabIndex={0}
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
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setExpandedMap((prev) => {
                const next = { ...prev, [templatePath]: !isExpanded };
                if (activeTemplateId) {
                  localStorage.setItem(getExpandedKey(activeTemplateId), JSON.stringify(next));
                }
                return next;
              });
            }
          }}
        >
          <span className="tree-toggle">{hasChildren ? (isExpanded ? '-' : '+') : '*'}</span>
          <strong dangerouslySetInnerHTML={{ __html: tagLabel }} />
          {loopBadge}
          <span className="tree-path" dangerouslySetInnerHTML={{ __html: pathLabel }} />
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
                  {t('field.deleteLoop')}
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
                {t('field.duplicate')}
              </button>
            )}
          </span>
        </div>
        {isExpanded && (
          <div className="tree-content">
            {node.attrs.length > 0 && (
              <div className="tree-attrs">
                {node.attrs.map((attr) => (
                  <div key={`${templatePath}/@${attr.name}`}>
                    {renderFieldBlock(`${templatePath}/@${attr.name}`, `@${attr.name}`)}
                  </div>
                ))}
              </div>
            )}
            {node.children.length === 0 && node.text !== undefined && (
              <div className="tree-text">{renderFieldBlock(templatePath, t('field.valueField'))}</div>
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
                      <div className="loop-label">
                        {t('field.iteration', { index: index + 1 })}
                      </div>
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

  return {    treeQuery,
    setTreeQuery,
    showSuggestions,
    setShowSuggestions,
    searchWrapRef,    filteredSuggestions,
    renderNodeEditor,
    expandAll,
    collapseAll,
    focusPath,
    focusRelation,
  };
};

export default useTree;







