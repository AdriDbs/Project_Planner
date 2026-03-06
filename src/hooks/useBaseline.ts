import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Baseline } from '../types/baseline';

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
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Baseline));
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

  return { baselines, loading, saving, error, createBaseline, updateBaseline, updateBaselineDebounced, importBaselines, deleteBaseline };
}
