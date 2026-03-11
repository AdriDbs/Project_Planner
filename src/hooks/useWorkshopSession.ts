import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  doc, collection, onSnapshot, addDoc, updateDoc,
  arrayUnion, arrayRemove, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  WorkshopSession, LeverDecision, WorkshopNewLever,
  ComputedSavings, LeversByQuadrant, QuadrantLeverItem
} from '../types/workshop';
import type { Lever } from '../types/lever';
import type { Baseline } from '../types/baseline';

export function useWorkshopSession(projectId: string | null) {
  const [session, setSession] = useState<WorkshopSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Subscribe to active session for project
  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, 'workshops'),
      where('projectId', '==', projectId),
      where('status', 'in', ['active', 'paused'])
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setSessionId(d.id);
        setSession({ id: d.id, ...d.data() } as WorkshopSession);
      } else {
        setSessionId(null);
        setSession(null);
      }
    });
    return unsub;
  }, [projectId]);

  // Load levers for the project
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'levers'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      setLevers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lever)));
    });
    return unsub;
  }, [projectId]);

  // Load baselines for the project
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'baselines'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      setBaselines(snap.docs.map(d => ({ id: d.id, ...d.data() } as Baseline)));
    });
    return unsub;
  }, [projectId]);

  const createSession = useCallback(async (data: Omit<WorkshopSession, 'id' | 'projectId' | 'decisions' | 'newLevers' | 'clientPriorities' | 'keyConstraints' | 'agreedScope' | 'startedAt' | 'completedAt' | 'status' | 'currentPhase'>) => {
    if (!projectId) throw new Error('No project selected');
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'workshops'), {
        ...data,
        projectId,
        currentPhase: 1,
        decisions: {},
        newLevers: [],
        clientPriorities: [],
        keyConstraints: [],
        agreedScope: '',
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSessionId(docRef.id);
      return docRef.id;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const resumeSession = useCallback(async (sid: string) => {
    await updateDoc(doc(db, 'workshops', sid), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    setSessionId(sid);
  }, []);

  const pauseSession = useCallback(async () => {
    if (!sessionId) return;
    await updateDoc(doc(db, 'workshops', sessionId), {
      status: 'paused',
      updatedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const completeSession = useCallback(async () => {
    if (!sessionId) return;
    await updateDoc(doc(db, 'workshops', sessionId), {
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const setPhase = useCallback(async (phase: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (!sessionId) return;
    await updateDoc(doc(db, 'workshops', sessionId), {
      currentPhase: phase,
      updatedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const updateSessionField = useCallback(async (updates: Partial<WorkshopSession>) => {
    if (!sessionId) return;
    await updateDoc(doc(db, 'workshops', sessionId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [sessionId]);

  const makeDecision = useCallback(async (leverId: string, decision: Partial<LeverDecision>) => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const existing = session?.decisions?.[leverId] ?? {
        leverId,
        status: 'pending',
        clientSavingsEstimate: null,
        useClientEstimate: false,
        commitment: null,
        owner: '',
        targetQuarter: '',
        effort: null,
        horizon: null,
        hasDebate: false,
        debatePositions: [],
        debateResolution: '',
        consultantNote: '',
        clientNote: '',
        decidedAt: new Date().toISOString(),
        decidedBy: '',
      };
      await updateDoc(doc(db, 'workshops', sessionId), {
        [`decisions.${leverId}`]: {
          ...existing,
          ...decision,
          decidedAt: new Date().toISOString(),
        },
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  }, [sessionId, session]);

  const createNewLever = useCallback(async (leverData: Omit<WorkshopNewLever, 'id' | 'workshopId' | 'createdAt' | 'savedToLibrary' | 'savedToProject'>) => {
    if (!sessionId) throw new Error('No active session');
    const newLever: WorkshopNewLever = {
      id: crypto.randomUUID(),
      workshopId: sessionId,
      createdAt: new Date().toISOString(),
      savedToLibrary: false,
      savedToProject: false,
      ...leverData,
    };
    await updateDoc(doc(db, 'workshops', sessionId), {
      newLevers: arrayUnion(newLever),
      updatedAt: serverTimestamp(),
    });
    return newLever;
  }, [sessionId]);

  const updateNewLever = useCallback(async (leverId: string, updates: Partial<WorkshopNewLever>) => {
    if (!sessionId || !session) return;
    const updatedLevers = session.newLevers.map(l =>
      l.id === leverId ? { ...l, ...updates } : l
    );
    await updateDoc(doc(db, 'workshops', sessionId), {
      newLevers: updatedLevers,
      updatedAt: serverTimestamp(),
    });
  }, [sessionId, session]);

  const deleteNewLever = useCallback(async (leverId: string) => {
    if (!sessionId || !session) return;
    const lever = session.newLevers.find(l => l.id === leverId);
    if (!lever) return;
    await updateDoc(doc(db, 'workshops', sessionId), {
      newLevers: arrayRemove(lever),
      updatedAt: serverTimestamp(),
    });
  }, [sessionId, session]);

  const decisions = session?.decisions ?? {};
  const newLevers = session?.newLevers ?? [];

  // Computed savings
  const computedSavings = useMemo((): ComputedSavings => {
    const validatedLibraryLevers = levers.filter(l =>
      decisions[l.id]?.status === 'validated'
    );

    const getSavings = (l: Lever) => {
      const d = decisions[l.id];
      return (d?.useClientEstimate && d?.clientSavingsEstimate != null)
        ? d.clientSavingsEstimate
        : (l.netSavingsEUR ?? 0);
    };

    const libraryCommitment = validatedLibraryLevers
      .filter(l => decisions[l.id]?.commitment === 'Commitment')
      .reduce((s, l) => s + getSavings(l), 0);

    const libraryFull = validatedLibraryLevers
      .reduce((s, l) => s + getSavings(l), 0);

    const terrainCommitment = newLevers
      .filter(l => l.commitment === 'Commitment')
      .reduce((s, l) => s + (l.estimatedAnnualSavings ?? 0), 0);

    const terrainFull = newLevers
      .reduce((s, l) => s + (l.estimatedAnnualSavings ?? 0), 0);

    const totalCommitment = libraryCommitment + terrainCommitment;
    const totalFull = libraryFull + terrainFull;

    const totalCapex = [
      ...validatedLibraryLevers.map(l => l.capexEUR ?? 0),
      ...newLevers.map(l => l.estimatedCapex ?? 0),
    ].reduce((s, v) => s + v, 0);

    const totalFTE = validatedLibraryLevers
      .reduce((s, l) => s + (l.fte ?? 0), 0);

    const baselineTotal = baselines
      .reduce((s, b) => {
        const ce = b.costElements ?? {};
        return s + Object.values(ce).reduce((ss, v) => ss + (v as number), 0);
      }, 0);

    return {
      library: { commitment: libraryCommitment, full: libraryFull },
      terrain: { commitment: terrainCommitment, full: terrainFull },
      total: { commitment: totalCommitment, full: totalFull },
      totalCapex,
      totalFTE,
      percentOfBaseline: baselineTotal > 0 ? totalFull / baselineTotal : 0,
      validatedCount: Object.values(decisions).filter(d => d.status === 'validated').length,
      debatedCount: Object.values(decisions).filter(d => d.status === 'debated').length,
      newLeversCount: newLevers.length,
    };
  }, [decisions, levers, newLevers, baselines]);

  // Levers by quadrant
  const leversByQuadrant = useMemo((): LeversByQuadrant => {
    const allItems: QuadrantLeverItem[] = [];

    // Library levers (validated)
    levers.filter(l => decisions[l.id]?.status === 'validated').forEach(l => {
      const d = decisions[l.id];
      const savings = (d?.useClientEstimate && d?.clientSavingsEstimate != null)
        ? d.clientSavingsEstimate
        : (l.netSavingsEUR ?? 0);
      allItems.push({
        id: l.id,
        title: l.title,
        savings,
        capex: l.capexEUR ?? 0,
        effort: d?.effort ?? null,
        improvementStructure: l.improvementStructure,
        owner: d?.owner ?? '',
        targetQuarter: d?.targetQuarter ?? '',
        isNewLever: false,
        commitment: d?.commitment ?? null,
      });
    });

    // Terrain levers
    newLevers.forEach(l => {
      allItems.push({
        id: l.id,
        title: l.title,
        savings: l.estimatedAnnualSavings ?? 0,
        capex: l.estimatedCapex ?? 0,
        effort: l.effort,
        improvementStructure: l.improvementStructure,
        owner: l.owner,
        targetQuarter: l.targetQuarter,
        isNewLever: true,
        commitment: l.commitment,
      });
    });

    const savingsValues = allItems.map(i => i.savings);
    const median = savingsValues.length > 0
      ? savingsValues.sort((a, b) => a - b)[Math.floor(savingsValues.length / 2)]
      : 0;

    const result: LeversByQuadrant = {
      quick_wins: [],
      big_bets: [],
      fill_in: [],
      challenge: [],
    };

    allItems.forEach(item => {
      const isEasy = item.effort === 'easy';
      const isHighSavings = item.savings > median;
      if (isEasy && isHighSavings) result.quick_wins.push(item);
      else if (!isEasy && isHighSavings) result.big_bets.push(item);
      else if (isEasy && !isHighSavings) result.fill_in.push(item);
      else result.challenge.push(item);
    });

    return result;
  }, [decisions, levers, newLevers]);

  // Fetch past sessions for admin view
  const fetchAllSessions = useCallback(async (): Promise<WorkshopSession[]> => {
    const snap = await getDocs(collection(db, 'workshops'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkshopSession));
  }, []);

  return {
    session,
    sessionId,
    levers,
    baselines,
    loading,
    saving,
    decisions,
    newLevers,
    computedSavings,
    leversByQuadrant,
    currentPhase: (session?.currentPhase ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
    createSession,
    resumeSession,
    pauseSession,
    completeSession,
    setPhase,
    updateSessionField,
    makeDecision,
    createNewLever,
    updateNewLever,
    deleteNewLever,
    fetchAllSessions,
  };
}
