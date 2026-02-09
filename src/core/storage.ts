import { PROJECTS_KEY, STORAGE_KEY, LAST_KEY, CATEGORIES_KEY } from './constants';
import type { TemplatePayload } from './types';

export const getTemplates = (): TemplatePayload[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const persistTemplates = (templates: TemplatePayload[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
};

export const getProjects = (): string[] => {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const persistProjects = (projects: string[]) => {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const getCategories = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const persistCategories = (categories: Record<string, string[]>) => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const getExpandedKey = (templateId: string) => `messagelab.expanded.${templateId}`;

export const persistLastId = (id: string) => {
  localStorage.setItem(LAST_KEY, id);
};

export const clearLastId = () => {
  localStorage.removeItem(LAST_KEY);
};

export const getLastId = () => localStorage.getItem(LAST_KEY);
