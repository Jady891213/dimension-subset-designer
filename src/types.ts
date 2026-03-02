export type ElementType = 'Consolidated' | 'Numeric' | 'String';

export interface DimensionElement {
  id: string;
  name: string;
  type: ElementType;
  level: number;
  children?: string[];
  parent?: string;
  weight?: number;
  attributes?: Record<string, string | number>;
}

export interface Subset {
  id: string;
  name: string;
  dimension: string;
  elements: string[];
  mdx?: string;
}

