import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, writeBatch, setDoc
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import type { Baseline, CostElement } from '../types/baseline';

export function useBaseline(projectId: string | null) {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    const q = query(collection(db, 'baselines'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      // Filter out v2 baseline documents (BaselineMatrix/BaselineVolumes have `rows` array, not `costElements`)
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => d.costElements && !Array.isArray(d.rows))
        .map(d => d as Baseline);
      setBaselines(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const createBaseline = useCallback(async (data: Omit<Baseline, 'id'>) => {
    const ref = await addDoc(collection(db, 'baselines'), data);
    return ref.id;
  }, []);

  const updateBaseline = useCallback(async (id: string, data: Partial<Baseline>) => {
    await updateDoc(doc(db, 'baselines', id), data);
  }, []);

  /**
   * Upsert a baseline using a deterministic document ID (`${projectId}_${plantId}`).
   * Creates the document if it does not exist; merges costElements if it does.
   * Throws on Firestore error so callers can handle it.
   */
  const upsertBaseline = useCallback(async (
    plantId: string,
    pProjectId: string,
    costElements: Record<CostElement, number>
  ) => {
    const docRef = doc(db, 'baselines', `${pProjectId}_${plantId}`);
    await setDoc(docRef, { projectId: pProjectId, plantId, costElements }, { merge: true });
  }, []);

  /**
   * Debounced variant of upsertBaseline.
   * Shows an error toast and logs to console if the Firestore write fails.
   * Never shows a success indicator — callers decide when to confirm success.
   */
  const upsertBaselineDebounced = useCallback((
    plantId: string,
    pProjectId: string,
    costElements: Record<CostElement, number>
  ) => {
    const key = `${pProjectId}_${plantId}`;
    setSaving(true);
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const docRef = doc(db, 'baselines', key);
        await setDoc(docRef, { projectId: pProjectId, plantId, costElements }, { merge: true });
      } catch (err) {
        console.error('[useBaseline] upsertBaselineDebounced failed:', err);
        toast.error('Erreur lors de la sauvegarde automatique');
      } finally {
        setSaving(false);
      }
    }, 800);
  }, []);

  const updateBaselineDebounced = useCallback((id: string, data: Partial<Baseline>) => {
    setSaving(true);
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(async () => {
      await updateDoc(doc(db, 'baselines', id), data);
      setSaving(false);
    }, 800);
  }, []);

  const importBaselines = useCallback(async (baselinesData: Partial<Baseline>[]) => {
    const batch = writeBatch(db);
    baselinesData.forEach(b => {
      const ref = doc(collection(db, 'baselines'));
      batch.set(ref, b);
    });
    await batch.commit();
  }, []);

  const deleteBaseline = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'baselines', id));
  }, []);

  return {
    baselines, loading, saving, error,
    createBaseline, updateBaseline, updateBaselineDebounced,
    upsertBaseline, upsertBaselineDebounced,
    importBaselines, deleteBaseline,
  };
}
