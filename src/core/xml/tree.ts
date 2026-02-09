import type { LoopSetting, XmlNode, FieldSetting } from '../types';
import { createFieldSetting, normalizeId, normalizeLoopId } from '../templates';

export const buildNode = (element: Element): XmlNode => {
  const attrs = [] as { name: string; value: string }[];
  for (const attr of Array.from(element.attributes)) {
    attrs.push({ name: attr.name, value: attr.value });
  }
  const children = Array.from(element.children).map(buildNode);
  const text = element.childElementCount === 0 ? element.textContent ?? '' : undefined;
  return { tag: element.tagName, attrs, children, text };
};

export const normalizeLoops = (
  node: XmlNode,
  path: string,
  loops: LoopSetting[],
): XmlNode => {
  const counts: Record<string, number> = {};
  for (const child of node.children) {
    counts[child.tag] = (counts[child.tag] || 0) + 1;
  }

  const normalizedChildren: XmlNode[] = [];
  const seen: Record<string, number> = {};

  for (const child of node.children) {
    seen[child.tag] = (seen[child.tag] || 0) + 1;
    const total = counts[child.tag];

    if (total > 1) {
      if (seen[child.tag] === 1) {
        const loopId = `${path}/${child.tag}`;
        loops.push({ id: loopId, label: loopId, count: total });
        child.loopId = loopId;
        normalizedChildren.push(child);
      }
    } else {
      normalizedChildren.push(child);
    }
  }

  node.children = normalizedChildren.map((child) =>
    normalizeLoops(child, `${path}/${child.tag}`, loops),
  );
  return node;
};

export const flattenFields = (node: XmlNode, path: string, fields: FieldSetting[]) => {
  const label = normalizeId(path);

  for (const attr of node.attrs) {
    const attrId = `${label}/@${attr.name}`;
    fields.push(createFieldSetting(attrId, attr.value));
  }

  if (node.children.length === 0 && node.text !== undefined) {
    const value = node.text.trim();
    if (value.length > 0) {
      fields.push(createFieldSetting(label, value));
    }
  }

  for (const child of node.children) {
    const childLabel = child.loopId ? `${path}/${child.tag}[]` : `${path}/${child.tag}`;
    flattenFields(child, childLabel, fields);
  }
};

export const collectPaths = (node: XmlNode, path: string, paths: string[]) => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  paths.push(templatePath);
  node.children.forEach((child) =>
    collectPaths(child, `${path}/${child.tag}${child.loopId ? '[]' : ''}`, paths),
  );
};

export const applyLoopMarker = (
  node: XmlNode,
  path: string,
  targetPath: string,
  loopId: string,
): XmlNode => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  const nextChildren = node.children.map((child) =>
    applyLoopMarker(
      child,
      `${path}/${child.tag}${child.loopId ? '[]' : ''}`,
      targetPath,
      loopId,
    ),
  );
  const nextNode = { ...node, children: nextChildren };
  if (templatePath === targetPath) {
    return { ...nextNode, loopId: normalizeLoopId(loopId) };
  }
  return nextNode;
};

export const clearLoopMarker = (
  node: XmlNode,
  path: string,
  targetPath: string,
): XmlNode => {
  const templatePath = normalizeId(path.replace(/\[\d+\]/g, '[]'));
  const nextChildren = node.children.map((child) =>
    clearLoopMarker(
      child,
      `${path}/${child.tag}${child.loopId ? '[]' : ''}`,
      targetPath,
    ),
  );
  const nextNode = { ...node, children: nextChildren };
  if (templatePath === targetPath) {
    return { ...nextNode, loopId: undefined };
  }
  return nextNode;
};

