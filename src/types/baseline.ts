import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Legacy types — kept for backward compatibility with existing Dashboard,
// useSavingsAggregates, excelCalculations, excelExporter, etc.
// ---------------------------------------------------------------------------

export type CostElement = 'RM' | 'PM' | 'DLC' | 'PILC' | 'OVC' | 'FC_Personal' | 'Maintenance' | 'OFC' | 'RM_Losses' | 'PM_Losses';

export type Department = 'Manufacturing' | 'Supply_Chain' | 'Maintenance' | 'Purchasing' | 'Quality' | 'GM' | 'HR' | 'IT' | 'Finance' | 'HSE' | 'Engineering';

export const COST_ELEMENTS: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];

export const COST_ELEMENT_LABELS: Record<CostElement, string> = {
  RM: 'Raw Materials',
  PM: 'Packaging Materials',
  DLC: 'Direct Labour Cost',
  PILC: 'Planned Indirect Labour Cost',
  OVC: 'Other Variable Costs',
  FC_Personal: 'Fixed Costs – Personnel',
  Maintenance: 'Maintenance',
  OFC: 'Other Fixed Costs',
  RM_Losses: 'RM Losses',
  PM_Losses: 'PM Losses',
};

export const DEPARTMENTS: Department[] = [
  'Manufacturing', 'Supply_Chain', 'Maintenance', 'Purchasing', 'Quality',
  'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering'
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  Manufacturing: 'Manufacturing',
  Supply_Chain: 'Supply Chain',
  Maintenance: 'Maintenance',
  Purchasing: 'Purchasing',
  Quality: 'Quality',
  GM: 'General Management',
  HR: 'Human Resources',
  IT: 'IT',
  Finance: 'Finance',
  HSE: 'HSE',
  Engineering: 'Engineering',
};

export interface Baseline {
  id: string;
  projectId: string;
  plantId: string;
  year: number;
  costElements: Record<CostElement, number>;
  fteByDepartment: Record<Department, number>;
  volume: number;
  totalFTE: number;
}

// ---------------------------------------------------------------------------
// New v2 types — 4 distinct baseline types
// ---------------------------------------------------------------------------

export type BaselineType = 'cost_element' | 'department' | 'fte_department' | 'volumes';

// Row labels for cost_element baseline (display order)
export const COST_ELEMENT_ROW_LABELS: string[] = [
  'RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC - Personal', 'Maintenance', 'OFC', 'RM Losses', 'PM Losses',
];

// Row labels for department / fte_department baselines (display order)
export const DEPARTMENT_ROW_LABELS: string[] = [
  'RM', 'PM', 'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing',
  'Quality', 'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering', 'RM Losses', 'PM Losses',
];

// Labels that are auto-calculated totals (read-only rows)
export const CALCULATED_ROW_LABELS = ['Total CC in k€', 'Total Costs in k€'] as const;

// Which rows contribute to "Total CC" for cost_element
export const CC_ROWS_COST_ELEMENT: string[] = ['DLC', 'PILC', 'OVC', 'FC - Personal', 'Maintenance', 'OFC'];

// Which rows contribute to "Total CC" for department/fte_department
export const CC_ROWS_DEPARTMENT: string[] = [
  'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality',
  'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering',
];

// "Total Costs" = RM + PM + Total CC (for both cost_element and department)
export const TOTAL_COST_ADDITIVE_ROWS: string[] = ['RM', 'PM'];

export const VOLUME_PLATFORMS: string[] = ['Processed Cheese', 'Hard Cheese', 'Fresh Cheese'];

// ---------------------------------------------------------------------------
// Generic matrix structure (cost_element | department | fte_department)
// ---------------------------------------------------------------------------

export interface BaselineMatrixRow {
  label: string;
  isCalculated: boolean;
  values: Record<string, number>; // plantName → raw value (euros or FTE)
  total: number;                  // "Baseline" column = sum of plant values
}

export interface BaselineMatrix {
  id: string;
  projectId: string;
  type: 'cost_element' | 'department' | 'fte_department';
  referenceLabel: string;         // e.g. "Actual 2018", "Budget 2024"
  rows: BaselineMatrixRow[];
  plants: string[];               // ordered list of plant names (columns)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Volumes structure
// ---------------------------------------------------------------------------

export interface BaselineVolumeRow {
  platform: string;
  plant: string;
  volume: number;
}

export interface BaselineVolumes {
  id: string;
  projectId: string;
  type: 'volumes';
  referenceLabel: string;         // e.g. "Volume A2018"
  rows: BaselineVolumeRow[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type BaselineEntry = BaselineMatrix | BaselineVolumes;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isBaselineMatrix(entry: BaselineEntry): entry is BaselineMatrix {
  return entry.type === 'cost_element' || entry.type === 'department' || entry.type === 'fte_department';
}

export function isBaselineVolumes(entry: BaselineEntry): entry is BaselineVolumes {
  return entry.type === 'volumes';
}

/** Compute Total CC value for a given set of row values (k€ display mode, but here raw) */
export function computeTotalCC(
  rowValues: Record<string, number>,
  type: 'cost_element' | 'department' | 'fte_department',
  plants: string[],
): number {
  const ccRows = type === 'cost_element' ? CC_ROWS_COST_ELEMENT : CC_ROWS_DEPARTMENT;
  return plants.reduce((sum, plant) => {
    // rowValues here is rowLabel→{plantName→value}, so we need a different approach
    return sum;
  }, 0);
}

/** Build default rows for a given baseline type (all zeros) */
export function buildDefaultRows(
  type: 'cost_element' | 'department' | 'fte_department',
  plants: string[],
): BaselineMatrixRow[] {
  const labels = type === 'cost_element' ? COST_ELEMENT_ROW_LABELS : DEPARTMENT_ROW_LABELS;
  const dataRows: BaselineMatrixRow[] = labels.map(label => ({
    label,
    isCalculated: false,
    values: Object.fromEntries(plants.map(p => [p, 0])),
    total: 0,
  }));

  // Add calculated rows
  dataRows.push(
    { label: 'Total CC in k€', isCalculated: true, values: Object.fromEntries(plants.map(p => [p, 0])), total: 0 },
    { label: 'Total Costs in k€', isCalculated: true, values: Object.fromEntries(plants.map(p => [p, 0])), total: 0 },
  );

  return dataRows;
}

/** Re-compute calculated rows in a matrix, returning updated rows */
export function recomputeCalculatedRows(
  rows: BaselineMatrixRow[],
  type: 'cost_element' | 'department' | 'fte_department',
  plants: string[],
): BaselineMatrixRow[] {
  const ccRows = type === 'cost_element' ? CC_ROWS_COST_ELEMENT : CC_ROWS_DEPARTMENT;
  const dataRows = rows.filter(r => !r.isCalculated);

  const getRowValues = (label: string): Record<string, number> => {
    const row = dataRows.find(r => r.label === label);
    return row ? row.values : Object.fromEntries(plants.map(p => [p, 0]));
  };

  const totalCCValues: Record<string, number> = {};
  const totalCostsValues: Record<string, number> = {};

  for (const plant of plants) {
    const ccSum = ccRows.reduce((s, lbl) => s + (getRowValues(lbl)[plant] ?? 0), 0);
    const rmVal = getRowValues('RM')[plant] ?? 0;
    const pmVal = getRowValues('PM')[plant] ?? 0;
    totalCCValues[plant] = ccSum;
    totalCostsValues[plant] = rmVal + pmVal + ccSum;
  }

  const totalCC = Object.values(totalCCValues).reduce((s, v) => s + v, 0);
  const totalCosts = Object.values(totalCostsValues).reduce((s, v) => s + v, 0);

  return [
    ...dataRows,
    { label: 'Total CC in k€', isCalculated: true, values: totalCCValues, total: totalCC },
    { label: 'Total Costs in k€', isCalculated: true, values: totalCostsValues, total: totalCosts },
  ];
}
