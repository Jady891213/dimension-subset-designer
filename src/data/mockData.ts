import { DimensionElement, Subset } from '../types';

export const mockElements: Record<string, DimensionElement> = {
  'Total Region': { id: 'Total Region', name: 'Total Region', type: 'Consolidated', level: 2, children: ['North America', 'Europe', 'Asia'], attributes: { Status: 'Active', ud1: 'Global', ud2: 'Mixed' } },
  'North America': { id: 'North America', name: 'North America', type: 'Consolidated', level: 1, children: ['US', 'Canada'], parent: 'Total Region', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'USD/CAD' } },
  'US': { id: 'US', name: 'US', type: 'Numeric', level: 0, parent: 'North America', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'USD' } },
  'Canada': { id: 'Canada', name: 'Canada', type: 'Numeric', level: 0, parent: 'North America', attributes: { Status: 'Inactive', ud1: 'Developed', ud2: 'CAD' } },
  'Europe': { id: 'Europe', name: 'Europe', type: 'Consolidated', level: 1, children: ['UK', 'France', 'Germany'], parent: 'Total Region', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'EUR/GBP' } },
  'UK': { id: 'UK', name: 'UK', type: 'Numeric', level: 0, parent: 'Europe', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'GBP' } },
  'France': { id: 'France', name: 'France', type: 'Numeric', level: 0, parent: 'Europe', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'EUR' } },
  'Germany': { id: 'Germany', name: 'Germany', type: 'Numeric', level: 0, parent: 'Europe', attributes: { Status: 'Inactive', ud1: 'Developed', ud2: 'EUR' } },
  'Asia': { id: 'Asia', name: 'Asia', type: 'Consolidated', level: 1, children: ['China', 'Japan', 'India'], parent: 'Total Region', attributes: { Status: 'Active', ud1: 'Emerging', ud2: 'Mixed' } },
  'China': { id: 'China', name: 'China', type: 'Numeric', level: 0, parent: 'Asia', attributes: { Status: 'Active', ud1: 'Emerging', ud2: 'CNY' } },
  'Japan': { id: 'Japan', name: 'Japan', type: 'Numeric', level: 0, parent: 'Asia', attributes: { Status: 'Active', ud1: 'Developed', ud2: 'JPY' } },
  'India': { id: 'India', name: 'India', type: 'Numeric', level: 0, parent: 'Asia', attributes: { Status: 'Active', ud1: 'Emerging', ud2: 'INR' } },
};

export const mockSubsets: Subset[] = [
  { id: 'sub1', name: 'Default', dimension: 'Region', elements: ['Total Region'], mdx: '{ [Region].[Total Region] }' },
  { id: 'sub2', name: 'Leaves', dimension: 'Region', elements: ['US', 'Canada', 'UK', 'France', 'Germany', 'China', 'Japan', 'India'], mdx: '{ TM1FILTERBYLEVEL( TM1SUBSETALL( [Region] ), 0) }' },
  { id: 'sub3', name: 'Europe Only', dimension: 'Region', elements: ['Europe', 'UK', 'France', 'Germany'], mdx: '{ DRILLDOWNMEMBER( { [Region].[Europe] }, { [Region].[Europe] } ) }' },
  { id: 'sub4', name: 'Static Subset', dimension: 'Region', elements: ['US', 'China', 'Japan'] },
];

export const rootElements = ['Total Region'];
