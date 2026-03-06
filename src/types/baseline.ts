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
