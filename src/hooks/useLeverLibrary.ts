import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  arrayUnion, getDocs, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LibraryLever, LibraryLeverFormData } from '../types/leverLibrary';
import type { Lever } from '../types/lever';

export function useLeverLibrary() {
  const [libraryLevers, setLibraryLevers] = useState<LibraryLever[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'leverLibrary'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      } as LibraryLever));
      setLibraryLevers(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addToLibrary = useCallback(async (lever: LibraryLeverFormData): Promise<string> => {
    const ref = await addDoc(collection(db, 'leverLibrary'), {
      ...lever,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, []);

  const updateLibraryLever = useCallback(async (id: string, data: Partial<LibraryLever>) => {
    await updateDoc(doc(db, 'leverLibrary', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const removeFromLibrary = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'leverLibrary', id), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const importLeversFromProject = useCallback(async (
    projectId: string,
    projectName: string,
    leverIds: string[],
  ): Promise<void> => {
    const leversSnap = await getDocs(
      query(collection(db, 'levers'), where('projectId', '==', projectId))
    );
    const leversToExport = leversSnap.docs
      .filter(d => leverIds.includes(d.id))
      .map(d => ({ id: d.id, ...d.data() } as Lever));

    for (const lever of leversToExport) {
      await addDoc(collection(db, 'leverLibrary'), {
        leverId: lever.leverId,
        title: lever.title,
        platform: lever.platform,
        department: lever.department,
        source: lever.source,
        improvementStructure: lever.improvementStructure,
        leverType: lever.leverType,
        digitalizationMechanization: lever.digitalizationMechanization,
        referenceNetSavingsEUR: lever.netSavingsEUR || 0,
        referenceCapexEUR: lever.capexEUR || 0,
        referenceFTE: lever.fte || 0,
        referencePayback: lever.payback || 0,
        benefits: lever.benefits || 0,
        feasibility: lever.feasibility || 0,
        originProjectId: projectId,
        originProjectName: projectName,
        usedInProjects: [projectId],
        tags: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }, []);

  const instantiateInProject = useCallback(async (
    libraryLeverId: string,
    projectId: string,
    plantId: string,
    overrides: Partial<Lever> = {},
  ): Promise<string> => {
    const libraryLever = libraryLevers.find(l => l.id === libraryLeverId);
    if (!libraryLever) throw new Error('Levier de bibliothèque introuvable');

    const leverData: Omit<Lever, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      plantId,
      libraryLeverId,
      isFromLibrary: true,
      leverId: libraryLever.leverId,
      title: libraryLever.title,
      platform: libraryLever.platform,
      department: libraryLever.department,
      source: libraryLever.source as Lever['source'],
      improvementStructure: libraryLever.improvementStructure as Lever['improvementStructure'],
      leverType: libraryLever.leverType as Lever['leverType'],
      digitalizationMechanization: libraryLever.digitalizationMechanization as Lever['digitalizationMechanization'],
      inBudget: false,
      inScope: true,
      commitment: 'Commitment',
      savingsByYear: {},
      fyTotalSavingsLC: 0,
      capexLC: libraryLever.referenceCapexEUR,
      approvedCapexLC: 0,
      oneOffOpexLC: 0,
      recurringOpexLC: 0,
      netSavingsLC: libraryLever.referenceNetSavingsEUR,
      fyTotalSavingsEUR: 0,
      capexEUR: libraryLever.referenceCapexEUR,
      approvedCapexEUR: 0,
      oneOffOpexEUR: 0,
      recurringOpexEUR: 0,
      netSavingsEUR: libraryLever.referenceNetSavingsEUR,
      payback: libraryLever.referencePayback,
      benefits: libraryLever.benefits,
      feasibility: libraryLever.feasibility,
      comment: '',
      fteSavingsType: 'Soft',
      fte: libraryLever.referenceFTE,
      oeeOrFte: '',
      gy: [],
      oee: [],
      ht: [],
      rmLosses: 0,
      pmLosses: 0,
      implementationStart: '',
      implementationEnd: '',
      projectDurationMonths: 0,
      capexImpactYear: '',
      kpiImpactYear: '',
      ...overrides,
    };

    const ref = await addDoc(collection(db, 'levers'), {
      ...leverData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Mettre à jour usedInProjects dans leverLibrary
    await updateDoc(doc(db, 'leverLibrary', libraryLeverId), {
      usedInProjects: arrayUnion(projectId),
      updatedAt: serverTimestamp(),
    });

    return ref.id;
  }, [libraryLevers]);

  return {
    libraryLevers,
    loading,
    error,
    addToLibrary,
    updateLibraryLever,
    removeFromLibrary,
    importLeversFromProject,
    instantiateInProject,
  };
}
