import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Workshop, WorkshopPhase, WorkshopLeverSelection } from '../types/workshop';

export function useWorkshops(projectId: string | null) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'workshops'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      } as Workshop));
      setWorkshops(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const createWorkshop = useCallback(async (
    data: Omit<Workshop, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'workshops'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, []);

  const updateWorkshop = useCallback(async (id: string, data: Partial<Workshop>) => {
    await updateDoc(doc(db, 'workshops', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteWorkshop = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'workshops', id));
  }, []);

  const updateWorkshopPhase = useCallback(async (id: string, phase: WorkshopPhase) => {
    await updateDoc(doc(db, 'workshops', id), {
      currentPhase: phase,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const saveWorkshopSelections = useCallback(async (
    id: string,
    selections: Record<string, WorkshopLeverSelection>
  ) => {
    await setDoc(doc(db, 'workshops', id), {
      leverSelections: selections,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, []);

  return {
    workshops,
    loading,
    error,
    createWorkshop,
    updateWorkshop,
    deleteWorkshop,
    updateWorkshopPhase,
    saveWorkshopSelections,
  };
}
