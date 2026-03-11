import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lever } from '../types/lever';

/**
 * Copie tous les leviers d'un projet vers la collection leverLibrary.
 * Les valeurs actuelles du levier deviennent les valeurs de référence.
 */
export async function migrateExistingLeversToLibrary(
  projectId: string,
  projectName: string,
): Promise<number> {
  const leversSnap = await getDocs(
    query(collection(db, 'levers'), where('projectId', '==', projectId))
  );

  let count = 0;
  for (const leverDoc of leversSnap.docs) {
    const lever = { id: leverDoc.id, ...leverDoc.data() } as Lever;

    // Vérifier si ce levier est déjà dans la bibliothèque (même leverId + originProjectId)
    const existing = await getDocs(
      query(
        collection(db, 'leverLibrary'),
        where('originProjectId', '==', projectId),
        where('leverId', '==', lever.leverId),
      )
    );
    if (!existing.empty) continue; // déjà migré

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
    count++;
  }

  return count;
}
