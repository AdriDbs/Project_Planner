import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Lever } from '../types/lever';

export function useLevers(projectId: string | null) {
  const [levers, setLevers] = useState<Lever[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    const q = query(collection(db, 'levers'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      } as Lever));
      setLevers(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const createLever = useCallback(async (data: Omit<Lever, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'levers'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, []);

  const updateLever = useCallback(async (id: string, data: Partial<Lever>) => {
    await updateDoc(doc(db, 'levers', id), { ...data, updatedAt: serverTimestamp() });
  }, []);

  const updateLeverDebounced = useCallback((id: string, data: Partial<Lever>) => {
    setSaving(true);
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(async () => {
      await updateDoc(doc(db, 'levers', id), { ...data, updatedAt: serverTimestamp() });
      setSaving(false);
    }, 800);
  }, []);

  const deleteLever = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'levers', id));
  }, []);

  const importLevers = useCallback(async (leversData: Partial<Lever>[]) => {
    const batch = writeBatch(db);
    leversData.forEach(l => {
      const ref = doc(collection(db, 'levers'));
      batch.set(ref, { ...l, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }, []);

  return { levers, loading, saving, error, createLever, updateLever, updateLeverDebounced, deleteLever, importLevers };
}
