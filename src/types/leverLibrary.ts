import type { Timestamp } from 'firebase/firestore';

export interface LibraryLever {
  id: string;
  // Identification
  leverId: string;              // ex. "MF29" — identifiant métier
  title: string;                // intitulé du levier
  platform: string;             // ex. "Processed Cheese"
  department: string;
  source: string;
  // Classification
  improvementStructure: string; // DLC | PILC | OVC | etc.
  leverType: string;
  digitalizationMechanization: string;
  // Valeurs de référence (ordre de grandeur, pas les vraies valeurs projet)
  referenceNetSavingsEUR: number;
  referenceCapexEUR: number;
  referenceFTE: number;
  referencePayback: number;
  benefits: number;             // score 1-5
  feasibility: number;          // score 1-5
  // Traçabilité
  originProjectId: string;
  originProjectName: string;
  usedInProjects: string[];     // liste des projectIds où ce levier est instancié
  tags: string[];
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type LibraryLeverFormData = Omit<LibraryLever, 'id' | 'createdAt' | 'updatedAt'>;
