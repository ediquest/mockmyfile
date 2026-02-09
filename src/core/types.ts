export type XmlAttr = {
  name: string;
  value: string;
};

export type XmlNode = {
  tag: string;
  attrs: XmlAttr[];
  children: XmlNode[];
  text?: string;
  loopId?: string;
};

export type FieldKind = 'text' | 'number' | 'date';

export type FieldMode = 'same' | 'increment' | 'random' | 'fixed';

export type FieldSetting = {
  id: string;
  label: string;
  value: string;
  kind: FieldKind;
  mode: FieldMode;
  step: number;
  min: number;
  max: number;
  length: number;
  dateSpanDays: number;
  fixedValue: string;
};

export type LoopSetting = {
  id: string;
  label: string;
  count: number;
};

export type Relation = {
  id: string;
  masterId: string;
  dependentId: string;
  prefix: string;
  suffix: string;
  enabled: boolean;
};

export type TemplatePayload = {
  id: string;
  name: string;
  description: string;
  project: string;
  category: string;
  xmlText: string;
  fields: FieldSetting[];
  loops: LoopSetting[];
  relations: Relation[];
  fileName: string;
};

export type ParseResult =
  | { ok: false; errorKey: 'error.xmlParse' }
  | {
      ok: true;
      root: XmlNode;
      fields: FieldSetting[];
      loops: LoopSetting[];
      relations: Relation[];
    };
