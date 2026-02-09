import JSZip from 'jszip';
import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { FieldSetting, LoopSetting, Relation, XmlNode } from '../../core/types';
import { escapeXml } from '../../core/xml/escape';
import { toIsoDate } from '../../core/xml/utils';
import { getBaseName, normalizeId, stripLoopMarkers } from '../../core/templates';

export type UseGenerateArgs = {
  root: XmlNode | null;
  fields: FieldSetting[];
  loops: LoopSetting[];
  relations: Relation[];
  fileName: string;
  filesToGenerate: number;
  setStatus: (value: string) => void;
};

const useGenerate = ({
  root,
  fields,
  loops,
  relations,
  fileName,
  filesToGenerate,
  setStatus,
}: UseGenerateArgs) => {
  const { t } = useI18n();
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

  const resolveValue = (
    templateId: string,
    fileIndex: number,
    loopIndexMap: Record<string, number>,
    cache: Map<string, string>,
    usedValues: Map<string, Set<string>>,
  ): string => {
    const cacheKey = `${templateId}::${fileIndex}::${JSON.stringify(loopIndexMap)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    const rel = relationByDependent.get(templateId);
    if (rel) {
      const masterValue = resolveValue(rel.masterId, fileIndex, loopIndexMap, cache, usedValues);
      const value = `${rel.prefix}${masterValue}${rel.suffix}`;
      cache.set(cacheKey, value);
      return value;
    }

    const field = fieldMap.get(templateId);
    if (!field) return '';

    const indexOffset = fileIndex + Object.values(loopIndexMap).reduce((a, b) => a + b, 0);
    const usedSet = (() => {
      if (!usedValues.has(field.id)) {
        usedValues.set(field.id, new Set<string>());
      }
      return usedValues.get(field.id)!;
    })();

    const getMaxUnique = () => {
      if (field.kind === 'number') {
        if (field.length > 0) {
          const digits = Math.max(1, Math.floor(field.length));
          return Math.pow(10, digits);
        }
        const min = Math.min(field.min, field.max);
        const max = Math.max(field.min, field.max);
        return Math.max(0, max - min + 1);
      }
      if (field.kind === 'date') {
        return Math.max(1, field.dateSpanDays);
      }
      if (field.kind === 'text') {
        const length = Math.max(4, field.length);
        const alphabet = 32;
        const val = Math.pow(alphabet, length);
        return Number.isFinite(val) ? val : null;
      }
      return null;
    };

    const pickUnique = (generator: () => string) => {
      const maxUnique = getMaxUnique();
      if (typeof maxUnique === 'number' && maxUnique > 0 && usedSet.size >= maxUnique) {
        throw new Error(t('status.uniqueValuesError', { field: field.label }));
      }
      const attempts = typeof maxUnique === 'number' && maxUnique > 0
        ? Math.min(10000, Math.ceil(maxUnique * 2))
        : 10000;
      for (let i = 0; i < attempts; i += 1) {
        const candidate = generator();
        if (!usedSet.has(candidate)) {
          usedSet.add(candidate);
          return candidate;
        }
      }
      throw new Error(t('status.uniqueValuesError', { field: field.label }));
    };
    let value = field.value;
    if (field.mode === 'fixed') {
      value = field.fixedValue;
    } else if (field.mode === 'increment') {
      if (field.kind === 'number') {
        const base = Number(field.value) || 0;
        value = String(base + field.step * indexOffset);
      } else if (field.kind === 'date') {
        const baseDate = new Date(field.value);
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + field.step * indexOffset);
        value = toIsoDate(next);
      }
    } else if (field.mode === 'random') {
      if (field.kind === 'number') {
        value = pickUnique(() => {
          if (field.length > 0) {
            const digits = Math.max(1, Math.floor(field.length));
            let out = '';
            for (let i = 0; i < digits; i += 1) {
              out += Math.floor(Math.random() * 10).toString();
            }
            return out;
          }
          const min = Math.min(field.min, field.max);
          const max = Math.max(field.min, field.max);
          const rand = Math.floor(min + Math.random() * (max - min + 1));
          return String(rand);
        });
      } else if (field.kind === 'date') {
        value = pickUnique(() => {
          const baseDate = new Date(field.value);
          const span = Math.max(1, field.dateSpanDays);
          const offset = Math.floor(Math.random() * span);
          const next = new Date(baseDate);
          next.setDate(baseDate.getDate() + offset);
          return toIsoDate(next);
        });
      } else {
        value = pickUnique(() => {
          const length = Math.max(4, field.length);
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let out = '';
          for (let i = 0; i < length; i += 1) {
            out += alphabet[Math.floor(Math.random() * alphabet.length)];
          }
          return out;
        });
      }
    }

    cache.set(cacheKey, value);
    return value;
  };

  const serializeNode = (
    node: XmlNode,
    path: string,
    fileIndex: number,
    loopIndexMap: Record<string, number>,
    cache: Map<string, string>,
    usedValues: Map<string, Set<string>>,
  ): string => {
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    const attrs = node.attrs
      .map((attr) => {
        const attrId = `${templatePath}/@${attr.name}`;
        const field = getFieldEntry(attrId);
        const value = field
          ? resolveValue(field.id, fileIndex, loopIndexMap, cache, usedValues)
          : attr.value;
        return ` ${attr.name}="${escapeXml(value)}"`;
      })
      .join('');

    if (node.children.length === 0) {
      const field = getFieldEntry(templatePath);
      const value = field
        ? resolveValue(field.id, fileIndex, loopIndexMap, cache, usedValues)
        : node.text ?? '';
      return `<${node.tag}${attrs}>${escapeXml(value)}</${node.tag}>`;
    }

    const children = node.children
      .map((child) => {
        if (child.loopId) {
          const loopId = child.loopId;
          const count = loopCountMap.get(loopId) ?? 1;
          const pieces = [] as string[];
          for (let i = 0; i < count; i += 1) {
            const nextLoop = { ...loopIndexMap, [loopId]: i };
            pieces.push(
              serializeNode(
                child,
                `${path}/${child.tag}[${i}]`,
                fileIndex,
                nextLoop,
                cache,
                usedValues,
              ),
            );
          }
          return pieces.join('');
        }
        return serializeNode(child, `${path}/${child.tag}`, fileIndex, loopIndexMap, cache, usedValues);
      })
      .join('');

    return `<${node.tag}${attrs}>${children}</${node.tag}>`;
  };

  const generateZip = async () => {
    if (!root) return;
    try {
      const zip = new JSZip();
      const baseName = getBaseName(fileName || 'message');
      const usedValues = new Map<string, Set<string>>();
      for (let i = 0; i < filesToGenerate; i += 1) {
        const cache = new Map<string, string>();
        const content = serializeNode(root, `/${root.tag}`, i, {}, cache, usedValues);
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${content}`;
        const fileLabel = `${baseName}_${i + 1}.xml`;
        zip.file(fileLabel, xml);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_generated.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(t('status.generateSuccess', { count: filesToGenerate }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('status.generateFailed');
      setStatus(message);
    }
  };

  return { generateZip };
};

export default useGenerate;
