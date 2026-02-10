export type XmlAttr = {
  name: string;
  value: string;
};

export type DataFormat = 'xml' | 'json' | 'csv';

export type JsonNodeType = 'object' | 'array' | 'value';

export type XmlNode = {
  tag: string;
  attrs: XmlAttr[];
  children: XmlNode[];
  text?: string;
  loopId?: string;
  jsonType?: JsonNodeType;
  jsonValue?: string;
  jsonValueKind?: FieldKind;
  jsonOriginalType?: 'string' | 'number' | 'boolean' | 'null';
};

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'null';

export type FieldMode = 'same' | 'increment' | 'random' | 'fixed' | 'list';

export type ListScope = 'perFile' | 'global';

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
  listText: string;
  listScope: ListScope;
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
  format?: DataFormat;
  csvDelimiter?: string;
};

export type StatusMessage =
  | { key: string; params?: Record<string, string | number> }
  | { text: string };

export type ParseResult =
  | { ok: false; errorKey: 'error.xmlParse' | 'error.jsonParse' | 'error.csvParse'; errorDetail?: string }
  | {
      ok: true;
      root: XmlNode;
      fields: FieldSetting[];
      loops: LoopSetting[];
      relations: Relation[];
    };
