import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DataFormat, FieldSetting, LoopSetting, Relation, StatusMessage, XmlNode } from '../../core/types';
import { parseXml } from '../../core/xml/parse';
import { parseJson } from '../../core/json/parse';
import { parseCsv } from '../../core/csv/parse';
import { extractLineCol } from '../../core/xml/utils';
import { collectPaths } from '../../core/xml/tree';
import { collectJsonPaths } from '../../core/json/tree';
import { formatXml } from '../../core/xml/format';
import { formatJson } from '../../core/json/format';
import { formatCsv } from '../../core/csv/format';
import { useI18n } from '../../i18n/I18nProvider';

export type UseXmlEditorArgs = {
  format: DataFormat;
  xmlText: string;
  setXmlText: Dispatch<SetStateAction<string>>;
  setRoot: Dispatch<SetStateAction<XmlNode | null>>;
  setFields: Dispatch<SetStateAction<FieldSetting[]>>;
  setLoops: Dispatch<SetStateAction<LoopSetting[]>>;
  setRelations: Dispatch<SetStateAction<Relation[]>>;
  setStatus: (value: StatusMessage | null) => void;
  setExpandedMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  setShowLoopInstances: Dispatch<SetStateAction<boolean>>;
  setCsvDelimiter: (value: string) => void;
};

const buildCollapsedMap = (root: XmlNode, format: DataFormat) => {
  const paths: string[] = [];
  if (format === 'json' || format === 'csv') {
    collectJsonPaths(root, `/${root.tag}`, paths);
  } else {
    collectPaths(root, `/${root.tag}`, paths);
  }
  const collapsed: Record<string, boolean> = {};
  paths.forEach((p) => {
    collapsed[p] = false;
  });
  return collapsed;
};

const useXmlEditor = ({
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
}: UseXmlEditorArgs) => {
  const { t } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [editedXml, setEditedXml] = useState('');
  const [xmlError, setXmlError] = useState('');
  const xmlInputRef = useRef<HTMLTextAreaElement | null>(null);
  const xmlPreviewRef = useRef<HTMLPreElement | null>(null);
  const xmlGutterRef = useRef<HTMLDivElement | null>(null);
  const xmlValidateTimeout = useRef<number | null>(null);

  const getEditableXmlText = (value: string) => {
    if (format !== 'xml') return value;
    if (value.includes('\n')) return value;
    return formatXml(value);
  };

  const getEditableJsonText = (value: string) => {
    if (format !== 'json') return value;
    if (value.includes('\n')) return value;
    return formatJson(value);
  };

  const getEditableCsvText = (value: string) => {
    if (format !== 'csv') return value;
    if (value.includes('\n')) return value;
    return formatCsv(value);
  };

  const getEditableText = (value: string) => {
    if (format === 'xml') return getEditableXmlText(value);
    if (format === 'json') return getEditableJsonText(value);
    if (format === 'csv') return getEditableCsvText(value);
    return value;
  };

  useEffect(() => {
    if (!editMode) return;
    if (xmlValidateTimeout.current) {
      window.clearTimeout(xmlValidateTimeout.current);
    }
    xmlValidateTimeout.current = window.setTimeout(() => {
      if (format === 'xml') {
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
        return;
      }

      if (format === 'json') {
        try {
          JSON.parse(editedXml);
          setXmlError('');
        } catch {
          setXmlError(t('error.jsonSyntaxGeneric'));
        }
        return;
      }

      if (format === 'csv') {
        const parsed = parseCsv(editedXml);
        if (!parsed.ok) {
          setXmlError(t('error.csvParse'));
        } else {
          setXmlError('');
        }
      }
    }, 300);
    return () => {
      if (xmlValidateTimeout.current) {
        window.clearTimeout(xmlValidateTimeout.current);
      }
    };
  }, [editedXml, editMode, format, t]);


  const handleEditToggle = () => {
    if (!editMode) {
      setEditedXml(getEditableText(xmlText));
      setXmlError('');
      setEditMode(true);
      return;
    }

    if (editedXml.trim() === xmlText.trim()) {
      setEditMode(false);
      return;
    }

    if (xmlError) {
      setStatus({ text: xmlError });
      return;
    }

    const parsed = format === 'csv'
      ? parseCsv(editedXml)
      : format === 'json'
        ? parseJson(editedXml)
        : parseXml(editedXml);
    if (!parsed.ok) {
      const detail = parsed.errorDetail ? ` (${parsed.errorDetail})` : '';
      setStatus({ text: `${t(parsed.errorKey)}${detail}` });
      return;
    }
    setStatus({ key: 'status.changesSaved' });
    setXmlText(editedXml);
    setRoot(parsed.root);
    setFields(parsed.fields);
    setLoops(parsed.loops);
    setRelations(parsed.relations);
    setExpandedMap(buildCollapsedMap(parsed.root, format));
    if (format === 'csv' && parsed.ok && 'delimiter' in parsed && typeof parsed.delimiter === 'string') {
      setCsvDelimiter(parsed.delimiter);
    }
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

