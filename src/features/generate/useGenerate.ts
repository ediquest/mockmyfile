import JSZip from 'jszip';
import { useMemo } from 'react';
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
  ): string => {
    const cacheKey = `${templateId}::${fileIndex}::${JSON.stringify(loopIndexMap)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    const rel = relationByDependent.get(templateId);
    if (rel) {
      const masterValue = resolveValue(rel.masterId, fileIndex, loopIndexMap, cache);
      const value = `${rel.prefix}${masterValue}${rel.suffix}`;
      cache.set(cacheKey, value);
      return value;
    }

    const field = fieldMap.get(templateId);
    if (!field) return '';

    const indexOffset = fileIndex + Object.values(loopIndexMap).reduce((a, b) => a + b, 0);
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
        if (field.length > 0) {
          const digits = Math.max(1, Math.floor(field.length));
          let out = '';
          for (let i = 0; i < digits; i += 1) {
            out += Math.floor(Math.random() * 10).toString();
          }
          value = out;
        } else {
          const min = Math.min(field.min, field.max);
          const max = Math.max(field.min, field.max);
          const rand = Math.floor(min + Math.random() * (max - min + 1));
          value = String(rand);
        }
      } else if (field.kind === 'date') {
        const baseDate = new Date(field.value);
        const span = Math.max(1, field.dateSpanDays);
        const offset = Math.floor(Math.random() * span);
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + offset);
        value = toIsoDate(next);
      } else {
        const length = Math.max(4, field.length);
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = '';
        for (let i = 0; i < length; i += 1) {
          out += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        value = out;
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
  ): string => {
    const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
    const attrs = node.attrs
      .map((attr) => {
        const attrId = `${templatePath}/@${attr.name}`;
        const field = getFieldEntry(attrId);
        const value = field
          ? resolveValue(field.id, fileIndex, loopIndexMap, cache)
          : attr.value;
        return ` ${attr.name}="${escapeXml(value)}"`;
      })
      .join('');

    if (node.children.length === 0) {
      const field = getFieldEntry(templatePath);
      const value = field
        ? resolveValue(field.id, fileIndex, loopIndexMap, cache)
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
              ),
            );
          }
          return pieces.join('');
        }
        return serializeNode(child, `${path}/${child.tag}`, fileIndex, loopIndexMap, cache);
      })
      .join('');

    return `<${node.tag}${attrs}>${children}</${node.tag}>`;
  };

  const generateZip = async () => {
    if (!root) return;
    const zip = new JSZip();
    const baseName = getBaseName(fileName || 'message');
    for (let i = 0; i < filesToGenerate; i += 1) {
      const cache = new Map<string, string>();
      const content = serializeNode(root, `/${root.tag}`, i, {}, cache);
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
    setStatus(`Wygenerowano ZIP z ${filesToGenerate} plikami.`);
  };

  return { generateZip };
};

export default useGenerate;
