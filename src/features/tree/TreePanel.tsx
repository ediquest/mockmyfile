import type { ReactNode, RefObject } from 'react';
import type { XmlNode } from '../../core/types';
import { highlightXml } from '../../core/xml/highlight';

export type TreePanelProps = {
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
}: TreePanelProps) => (
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
          onClick={() => setShowLoopInstances(!showLoopInstances)}
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
            dangerouslySetInnerHTML={{ __html: highlightXml(editedXml) }}
          />
        </div>
        {xmlError && <div className="xml-error">{xmlError}</div>}
      </div>
    ) : (
      <div className="tree">{renderNodeEditor(root, `/${root.tag}`)}</div>
    )}
  </section>
);

export default TreePanel;


