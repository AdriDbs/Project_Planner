import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Project, Plant } from '../types/project';
import { useProjectStore } from '../store/projectStore';

export function useProjects() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { projects, setProjects } = useProjectStore();

  useEffect(() => {
    const q = query(collection(db, 'projects'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as Project));
      setProjects(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, []);

  const createProject = useCallback(async (data: Omit<Project, 'id' | 'createdAt'>) => {
    const ref = await addDoc(collection(db, 'projects'), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    await updateDoc(doc(db, 'projects', id), data);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'projects', id));
  }, []);

  return { projects, loading, error, createProject, updateProject, deleteProject };
}

export function usePlants(projectId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { plants, setPlants } = useProjectStore();

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    const q = query(collection(db, 'plants'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Plant));
      setPlants(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  const createPlant = useCallback(async (data: Omit<Plant, 'id'>) => {
    const ref = await addDoc(collection(db, 'plants'), data);
    return ref.id;
  }, []);

  const updatePlant = useCallback(async (id: string, data: Partial<Plant>) => {
    await updateDoc(doc(db, 'plants', id), data);
  }, []);

  const deletePlant = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'plants', id));
  }, []);

  return { plants, loading, error, createPlant, updatePlant, deletePlant };
}
