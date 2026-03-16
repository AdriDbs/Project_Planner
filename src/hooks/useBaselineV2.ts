import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc, onSnapshot, setDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import type {
  BaselineType,
  BaselineEntry,
  BaselineMatrix,
  BaselineMatrixRow,
  BaselineVolumes,
  BaselineVolumeRow,
} from '../types/baseline';
import { buildDefaultRows, recomputeCalculatedRows } from '../types/baseline';

// ---------------------------------------------------------------------------
// Hook state shape
// ---------------------------------------------------------------------------

type LoadingState = Record<BaselineType, boolean>;
type BaselineState = Record<BaselineType, BaselineEntry | null>;

function makeDocId(projectId: string, type: BaselineType): string {
  return `${projectId}_${type}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBaselineV2(projectId: string | null) {
  const [baselines, setBaselines] = useState<BaselineState>({
    cost_element: null,
    department: null,
    fte_department: null,
    volumes: null,
  });

  const [loading, setLoading] = useState<LoadingState>({
    cost_element: true,
    department: true,
    fte_department: true,
    volumes: true,
  });

  const [saving, setSaving] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const unsubs = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Clean up previous listeners
    unsubs.current.forEach(u => u());
    unsubs.current = [];

    if (!projectId) {
      setLoading({ cost_element: false, department: false, fte_department: false, volumes: false });
      return;
    }

    const types: BaselineType[] = ['cost_element', 'department', 'fte_department', 'volumes'];
    types.forEach(type => {
      const docRef = doc(db, 'baselines', makeDocId(projectId, type));
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          setBaselines(prev => ({
            ...prev,
            [type]: snap.exists() ? ({ id: snap.id, ...snap.data() } as BaselineEntry) : null,
          }));
          setLoading(prev => ({ ...prev, [type]: false }));
        },
        (err) => {
          console.error(`[useBaselineV2] onSnapshot error for ${type}:`, err);
          setLoading(prev => ({ ...prev, [type]: false }));
        },
      );
      unsubs.current.push(unsub);
    });

    return () => {
      unsubs.current.forEach(u => u());
      unsubs.current = [];
    };
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // Save a full baseline entry (upsert)
  // ---------------------------------------------------------------------------

  const saveBaseline = useCallback(async (
    pProjectId: string,
    type: BaselineType,
    data: Omit<BaselineMatrix, 'id' | 'createdAt' | 'updatedAt'> | Omit<BaselineVolumes, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const docId = makeDocId(pProjectId, type);
    const docRef = doc(db, 'baselines', docId);
    setSaving(true);
    try {
      const snap = await getDoc(docRef);
      const payload = {
        ...data,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      };
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      console.error('[useBaselineV2] saveBaseline failed:', err);
      toast.error('Erreur lors de la sauvegarde');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Update a single cell in a matrix baseline (debounced)
  // ---------------------------------------------------------------------------

  const updateCell = useCallback((
    type: 'cost_element' | 'department' | 'fte_department',
    rowLabel: string,
    plant: string,
    value: number,
  ) => {
    if (!projectId) return;

    const docId = makeDocId(projectId, type);
    setSaving(true);

    if (debounceTimers.current[docId]) clearTimeout(debounceTimers.current[docId]);
    debounceTimers.current[docId] = setTimeout(async () => {
      try {
        const current = baselines[type] as BaselineMatrix | null;
        const plants = current?.plants ?? [];
        let rows: BaselineMatrixRow[] = current?.rows ?? buildDefaultRows(type, plants);

        // Update the specific cell
        rows = rows.map(row => {
          if (row.label === rowLabel && !row.isCalculated) {
            const newValues = { ...row.values, [plant]: value };
            const newTotal = Object.values(newValues).reduce((s, v) => s + v, 0);
            return { ...row, values: newValues, total: newTotal };
          }
          return row;
        });

        // Recompute calculated rows
        rows = recomputeCalculatedRows(rows, type, plants);

        const docRef = doc(db, 'baselines', docId);
        await setDoc(docRef, {
          projectId,
          type,
          rows,
          plants,
          referenceLabel: current?.referenceLabel ?? '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('[useBaselineV2] updateCell failed:', err);
        toast.error('Erreur lors de la sauvegarde automatique');
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [projectId, baselines]);

  // ---------------------------------------------------------------------------
  // Volume row management
  // ---------------------------------------------------------------------------

  const saveVolumes = useCallback(async (
    pProjectId: string,
    rows: BaselineVolumeRow[],
    referenceLabel: string,
  ) => {
    const docId = makeDocId(pProjectId, 'volumes');
    const docRef = doc(db, 'baselines', docId);
    setSaving(true);
    try {
      await setDoc(docRef, {
        projectId: pProjectId,
        type: 'volumes',
        rows,
        referenceLabel,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('[useBaselineV2] saveVolumes failed:', err);
      toast.error('Erreur lors de la sauvegarde');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch all baselines for a project (one-time, for read-only usage)
  // ---------------------------------------------------------------------------

  const fetchAllBaselines = useCallback(async (pProjectId: string) => {
    const types: BaselineType[] = ['cost_element', 'department', 'fte_department', 'volumes'];
    const results: Partial<BaselineState> = {};
    await Promise.all(types.map(async type => {
      const snap = await getDoc(doc(db, 'baselines', makeDocId(pProjectId, type)));
      results[type] = snap.exists() ? ({ id: snap.id, ...snap.data() } as BaselineEntry) : null;
    }));
    return results as BaselineState;
  }, []);

  const isLoading = Object.values(loading).some(Boolean);

  return {
    baselines,
    loading,
    isLoading,
    saving,
    saveBaseline,
    updateCell,
    saveVolumes,
    fetchAllBaselines,
  };
}
