export type CommitmentType = 'Commitment' | 'Additional Potential' | 'No Go';
export type LeverType = 'Digitalization/Automation' | 'Operational Basics' | 'Autonomous Organization' | 'Complexity Management';
export type DigitalizationType = 'Digitalization' | 'Mechanization' | 'Other Lever Type';
export type ImprovementStructure = 'DLC' | 'PILC' | 'OVC' | 'FC-Personal' | 'Maintenance' | 'OFC' | 'RM Losses' | 'PM Losses';
export type FTESavingsType = 'Hard' | 'Soft' | 'Not impacting';
export type LeverSource = 'Result plan' | 'On-site Workshop' | 'Other';

export const IMPROVEMENT_STRUCTURES: ImprovementStructure[] = [
  'DLC', 'PILC', 'OVC', 'FC-Personal', 'Maintenance', 'OFC', 'RM Losses', 'PM Losses'
];

export const LEVER_TYPES: LeverType[] = [
  'Digitalization/Automation', 'Operational Basics', 'Autonomous Organization', 'Complexity Management'
];

export const DEPARTMENTS_LEVER = [
  'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality',
  'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering'
];

export interface Lever {
  id: string;
  projectId: string;
  plantId: string;
  libraryLeverId: string | null;  // référence vers leverLibrary (null si créé from scratch)
  isFromLibrary: boolean;         // true si instancié depuis la bibliothèque
  leverId: string;
  platform: string;
  department: string;
  title: string;
  source: LeverSource | string;
  improvementStructure: ImprovementStructure;
  leverType: LeverType;
  digitalizationMechanization: DigitalizationType;
  inBudget: boolean;
  inScope: boolean;
  commitment: CommitmentType;
  savingsByYear: Record<string, number>;
  fyTotalSavingsLC: number;
  capexLC: number;
  approvedCapexLC: number;
  oneOffOpexLC: number;
  recurringOpexLC: number;
  netSavingsLC: number;
  fyTotalSavingsEUR: number;
  capexEUR: number;
  approvedCapexEUR: number;
  oneOffOpexEUR: number;
  recurringOpexEUR: number;
  netSavingsEUR: number;
  payback: number;
  benefits: number;
  feasibility: number;
  comment: string;
  fteSavingsType: FTESavingsType;
  fte: number;
  oeeOrFte: string;
  gy: number[];
  oee: number[];
  ht: number[];
  rmLosses: number;
  pmLosses: number;
  implementationStart: string;
  implementationEnd: string;
  projectDurationMonths: number;
  capexImpactYear: string;
  kpiImpactYear: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LeverFormData = Omit<Lever, 'id' | 'createdAt' | 'updatedAt'>;
