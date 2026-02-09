import type { ReactNode, RefObject } from 'react';
import type { DataFormat, XmlNode } from '../../core/types';
import { highlightXml } from '../../core/xml/highlight';
import { highlightJson } from '../../core/json/highlight';
import { useI18n } from '../../i18n/I18nProvider';

export type TreePanelProps = {
  format: DataFormat;
  root: XmlNode;
  fileName: string;
  treeQuery: string;
  setTreeQuery: (value: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (value: boolean) => void;
  filteredSuggestions: string[];
  focusPath: (path: string) => void;
  editMode: boolean;
  showLoopInstances: boolean;
  setShowLoopInstances: (value: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  handleEditToggle: () => void;
  editedXml: string;
  setEditedXml: (value: string) => void;
  xmlText: string;
  xmlError: string;
  xmlInputRef: RefObject<HTMLTextAreaElement | null>;
  xmlPreviewRef: RefObject<HTMLPreElement | null>;
  xmlGutterRef: RefObject<HTMLDivElement | null>;
  searchWrapRef: RefObject<HTMLDivElement | null>;
  renderNodeEditor: (node: XmlNode, path: string) => ReactNode;
};

const TreePanel = ({
  format,
  root,
  fileName,
  treeQuery,
  setTreeQuery,
  showSuggestions,
  setShowSuggestions,
  filteredSuggestions,
  focusPath,
  editMode,
  showLoopInstances,
  setShowLoopInstances,
  expandAll,
  collapseAll,
  handleEditToggle,
  editedXml,
  setEditedXml,
  xmlText,
  xmlError,
  xmlInputRef,
  xmlPreviewRef,
  xmlGutterRef,
  searchWrapRef,
  renderNodeEditor,
}: TreePanelProps) => {
  const { t } = useI18n();
  const canEditSource = format === 'xml' || format === 'json';
  const effectiveEditMode = canEditSource && editMode;

  return (
    <section className="panel">
      <div className="panel-row">
        <div className="panel-title">
          <h2>{t('tree.title')}</h2>
          {fileName && <span className="file-chip">{t('tree.fileLabel', { name: fileName })}</span>}
        </div>
        <div className="panel-actions">
          <div className="search-wrap" ref={searchWrapRef}>
            <input
              className="input search"
              placeholder={t('tree.searchPlaceholder')}
              value={treeQuery}
              onChange={(e) => {
                setTreeQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              disabled={effectiveEditMode}
            />
            {showSuggestions && filteredSuggestions.length > 0 && !effectiveEditMode && (
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
              disabled={effectiveEditMode}
            >
              {t('tree.clear')}
            </button>
          )}
          <button
            className="button ghost"
            onClick={() => setShowLoopInstances(!showLoopInstances)}
            disabled={effectiveEditMode}
          >
            {showLoopInstances ? t('tree.collapseIterations') : t('tree.expandIterations')}
          </button>
          <button className="button ghost" onClick={expandAll} disabled={effectiveEditMode}>
            {t('tree.expandAll')}
          </button>
          <button className="button ghost" onClick={collapseAll} disabled={effectiveEditMode}>
            {t('tree.collapseAll')}
          </button>
          {canEditSource && editMode && (
            <button
              className="button ghost"
              onClick={() => {
                setEditedXml(xmlText);
              }}
            >
              {t('tree.undoChanges')}
            </button>
          )}
          {canEditSource && (
            <button className="button" onClick={handleEditToggle}>
              {editMode
                ? editedXml.trim() === xmlText.trim()
                  ? t('tree.close')
                  : t('tree.save')
                : t('tree.edit')}
            </button>
          )}
        </div>
      </div>
      {canEditSource && editMode ? (
        <div className="xml-editor">
          <div className="xml-gutter" ref={xmlGutterRef} aria-hidden="true">
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
              dangerouslySetInnerHTML={{
                __html: format === 'json' ? highlightJson(editedXml) : highlightXml(editedXml),
              }}
            />
          </div>
          {xmlError && <div className="xml-error">{xmlError}</div>}
        </div>
      ) : (
        <div className="tree">{renderNodeEditor(root, `/${root.tag}`)}</div>
      )}
    </section>
  );
};

export default TreePanel;
