// ─── Workshop Types ──────────────────────────────────────────────────────────

export type LeverStatus = 'pending' | 'validated' | 'debated' | 'rejected' | 'deferred';

export type LeverDecision = {
  leverId: string;
  status: LeverStatus;

  // Scoring co-construit avec le client
  clientSavingsEstimate: number | null;
  useClientEstimate: boolean;

  // Plan de transformation
  commitment: 'Commitment' | 'Additional Potential' | 'No Go' | null;
  owner: string;
  targetQuarter: string; // ex. "Q3 2025"
  effort: 'easy' | 'medium' | 'complex' | null;
  horizon: 'short' | 'medium' | 'long' | null; // <6m / 6-18m / >18m

  // Désaccords
  hasDebate: boolean;
  debatePositions: {
    position: string;
    author: string;
    timestamp: string;
  }[];
  debateResolution: string;

  // Notes
  consultantNote: string; // confidentielle, non affichée au client
  clientNote: string;     // visible dans le livrable

  decidedAt: string;
  decidedBy: string;
};

// Levier créé pendant l'atelier (Phase 3)
export type WorkshopNewLever = {
  id: string;                       // uuid généré côté client
  workshopId: string;
  createdInPhase: 3;
  createdAt: string;

  // Champs essentiels — saisie rapide
  title: string;                    // required
  department: string;               // required
  improvementStructure: string;     // required
  plantId: string;                  // required
  leverType: string;
  source: 'On-site Workshop';       // toujours cette valeur pour les leviers créés en atelier

  // Financiers — ordre de grandeur
  estimatedAnnualSavings: number;   // en €, saisi par le client
  estimatedCapex: number;
  commitment: 'Commitment' | 'Additional Potential';

  // Plan
  owner: string;
  targetQuarter: string;
  effort: 'easy' | 'medium' | 'complex' | null;
  horizon: 'short' | 'medium' | 'long' | null;

  // Notes
  context: string;                  // pourquoi ce levier a émergé en atelier
  consultantNote: string;

  // Statut de synchronisation
  savedToLibrary: boolean;          // true une fois exporté vers leverLibrary
  savedToProject: boolean;          // true une fois créé dans la collection levers
};

export type WorkshopParticipant = {
  name: string;
  role: string;
  isRemote: boolean;
};

export type WorkshopSession = {
  id: string;
  projectId: string;
  clientName: string;
  workshopDate: string;
  facilitator: string;
  participants: WorkshopParticipant[];
  selectedPlantIds: string[];
  currentPhase: 1 | 2 | 3 | 4 | 5 | 6;
  decisions: Record<string, LeverDecision>;   // leviers bibliothèque
  newLevers: WorkshopNewLever[];              // leviers créés en Phase 3

  // Contexte Phase 1
  clientPriorities: string[];
  keyConstraints: string[];
  agreedScope: string;

  startedAt: string;
  completedAt: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
};

// ─── Computed Savings ────────────────────────────────────────────────────────

export type ComputedSavings = {
  library: { commitment: number; full: number };
  terrain: { commitment: number; full: number };
  total: { commitment: number; full: number };
  totalCapex: number;
  totalFTE: number;
  percentOfBaseline: number;
  validatedCount: number;
  debatedCount: number;
  newLeversCount: number;
};

export type QuadrantKey = 'quick_wins' | 'big_bets' | 'fill_in' | 'challenge';

export type LeversByQuadrant = {
  quick_wins: QuadrantLeverItem[];
  big_bets: QuadrantLeverItem[];
  fill_in: QuadrantLeverItem[];
  challenge: QuadrantLeverItem[];
};

export type QuadrantLeverItem = {
  id: string;
  title: string;
  savings: number;
  capex: number;
  effort: 'easy' | 'medium' | 'complex' | null;
  improvementStructure: string;
  owner: string;
  targetQuarter: string;
  isNewLever: boolean;
  commitment: string | null;
};
