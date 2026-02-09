import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldSetting, LoopSetting, Relation, XmlNode } from '../../core/types';
import { parseXml } from '../../core/xml/parse';
import { extractLineCol } from '../../core/xml/utils';
import { collectPaths } from '../../core/xml/tree';
import { useI18n } from '../../i18n/I18nProvider';

export type UseXmlEditorArgs = {
  xmlText: string;
  setXmlText: Dispatch<SetStateAction<string>>;
  setRoot: Dispatch<SetStateAction<XmlNode | null>>;
  setFields: Dispatch<SetStateAction<FieldSetting[]>>;
  setLoops: Dispatch<SetStateAction<LoopSetting[]>>;
  setRelations: Dispatch<SetStateAction<Relation[]>>;
  setStatus: (value: string) => void;
  setExpandedMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  setShowLoopInstances: Dispatch<SetStateAction<boolean>>;
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

const useXmlEditor = ({
  xmlText,
  setXmlText,
  setRoot,
  setFields,
  setLoops,
  setRelations,
  setStatus,
  setExpandedMap,
  setShowLoopInstances,
}: UseXmlEditorArgs) => {
  const { t } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [editedXml, setEditedXml] = useState('');
  const [xmlError, setXmlError] = useState('');
  const xmlInputRef = useRef<HTMLTextAreaElement | null>(null);
  const xmlPreviewRef = useRef<HTMLPreElement | null>(null);
  const xmlGutterRef = useRef<HTMLDivElement | null>(null);
  const xmlValidateTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!editMode) return;
    if (xmlValidateTimeout.current) {
      window.clearTimeout(xmlValidateTimeout.current);
    }
    xmlValidateTimeout.current = window.setTimeout(() => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editedXml, 'application/xml');
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        const details = extractLineCol(parseError.textContent ?? '');
        if (details?.line && details?.col) {
          setXmlError(
            t('error.xmlSyntaxLineCol', { line: details.line, col: details.col }),
          );
        } else if (details?.line) {
          setXmlError(t('error.xmlSyntaxLine', { line: details.line }));
        } else {
          setXmlError(t('error.xmlSyntaxGeneric'));
        }
      } else {
        setXmlError('');
      }
    }, 300);
    return () => {
      if (xmlValidateTimeout.current) {
        window.clearTimeout(xmlValidateTimeout.current);
      }
    };
  }, [editedXml, editMode, t]);

  const handleEditToggle = () => {
    if (!editMode) {
      setEditedXml(xmlText);
      setXmlError('');
      setEditMode(true);
      return;
    }

    if (editedXml.trim() === xmlText.trim()) {
      setEditMode(false);
      return;
    }

    if (xmlError) {
      setStatus(xmlError);
      return;
    }

    const parsed = parseXml(editedXml);
    if (!parsed.ok) {
      setStatus(t(parsed.errorKey));
      return;
    }
    setStatus(t('status.changesSaved'));
    setXmlText(editedXml);
    setRoot(parsed.root);
    setFields(parsed.fields);
    setLoops(parsed.loops);
    setRelations(parsed.relations);
    setExpandedMap(buildCollapsedMap(parsed.root));
    setShowLoopInstances(false);
    setEditMode(false);
  };

  return {
    editMode,
    editedXml,
    setEditedXml,
    xmlError,
    setXmlError,
    handleEditToggle,
    xmlInputRef,
    xmlPreviewRef,
    xmlGutterRef,
  };
};

export default useXmlEditor;

