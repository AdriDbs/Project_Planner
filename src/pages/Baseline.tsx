import React, { useState, useCallback } from 'react';
import { Upload, Download, Pencil, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { useProjectStore } from '../store/projectStore';
import { useBaseline } from '../hooks/useBaseline';
import { usePlants } from '../hooks/useProjects';
import { COST_ELEMENTS, COST_ELEMENT_LABELS } from '../types/baseline';
import type { CostElement, Baseline } from '../types/baseline';
import { formatNumber } from '../lib/calculations';
import { parseBaselineExcel } from '../lib/importers';
import { exportBaselineToExcel } from '../lib/exporters';

// Draft stores raw strings keyed by plantId → costElement
type DraftValues = Record<string, Record<CostElement, string>>;

function parseRaw(raw: string): number {
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function BaselinePage() {
  const { selectedProjectId, locale } = useProjectStore();
  const { baselines, loading, saving, updateBaseline, upsertBaseline, importBaselines } = useBaseline(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);

  const [isEditMode, setIsEditMode] = useState(false);
  const [draftValues, setDraftValues] = useState<DraftValues>({});
  const [isSaving, setIsSaving] = useState(false);

  const getBaselineForPlant = useCallback(
    (plantId: string): Baseline | undefined => baselines.find(b => b.plantId === plantId),
    [baselines]
  );

  const enterEditMode = useCallback(() => {
    const draft: DraftValues = {};
    for (const plant of plants) {
      const b = getBaselineForPlant(plant.id);
      draft[plant.id] = {} as Record<CostElement, string>;
      for (const el of COST_ELEMENTS) {
        draft[plant.id][el] = String(b?.costElements[el] ?? 0);
      }
    }
    setDraftValues(draft);
    setIsEditMode(true);
  }, [plants, getBaselineForPlant]);

  const cancelEditMode = useCallback(() => {
    setDraftValues({});
    setIsEditMode(false);
  }, []);

  const handleCellChange = useCallback((plantId: string, costEl: CostElement, rawValue: string) => {
    setDraftValues(prev => ({
      ...prev,
      [plantId]: {
        ...prev[plantId],
        [costEl]: rawValue,
      },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const updates: Promise<void>[] = [];
      for (const plant of plants) {
        const plantDraft = draftValues[plant.id];
        if (!plantDraft) continue;

        const costElements = {} as Record<CostElement, number>;
        for (const el of COST_ELEMENTS) {
          costElements[el] = parseRaw(plantDraft[el] ?? '0');
        }

        const baseline = baselines.find(b => b.plantId === plant.id);
        if (baseline) {
          // Update existing document (preserves all other fields)
          updates.push(updateBaseline(baseline.id, { costElements }));
        } else {
          // No baseline exists yet for this plant — create with deterministic ID
          updates.push(upsertBaseline(plant.id, selectedProjectId, costElements));
        }
      }

      await Promise.all(updates);
      toast.success('Baseline sauvegardée avec succès');
      setDraftValues({});
      setIsEditMode(false);
    } catch (err) {
      console.error('[BaselinePage] handleSave failed:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [plants, draftValues, baselines, selectedProjectId, updateBaseline, upsertBaseline]);

  const getCellDisplay = (plantId: string, costEl: CostElement): string => {
    if (isEditMode) {
      return draftValues[plantId]?.[costEl] ?? '0';
    }
    const baseline = getBaselineForPlant(plantId);
    return formatNumber(baseline?.costElements[costEl] ?? 0, locale);
  };

  const getDraftNumber = (plantId: string, costEl: CostElement): number => {
    const raw = draftValues[plantId]?.[costEl];
    return raw !== undefined ? parseRaw(raw) : (getBaselineForPlant(plantId)?.costElements[costEl] ?? 0);
  };

  const getGroupTotal = (costEl: CostElement): number => {
    if (isEditMode) {
      return plants.reduce((s, p) => s + getDraftNumber(p.id, costEl), 0);
    }
    return baselines.reduce((s, b) => s + (b.costElements[costEl] ?? 0), 0);
  };

  const totalCostPerPlant = (plantId: string): number => {
    if (isEditMode) {
      return COST_ELEMENTS.reduce((s, el) => s + getDraftNumber(plantId, el), 0);
    }
    const b = getBaselineForPlant(plantId);
    return b ? Object.values(b.costElements).reduce((s, v) => s + v, 0) : 0;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    const plantMap: Record<string, string> = {};
    plants.forEach(p => { plantMap[p.name] = p.id; });
    try {
      const data = await parseBaselineExcel(file, selectedProjectId, plantMap);
      await importBaselines(data);
      toast.success(`${data.length} baselines importées avec succès`);
    } catch (err) {
      toast.error(`Erreur d'import: ${(err as Error).message}`);
    }
    e.target.value = '';
  };

  const handleExport = () => {
    exportBaselineToExcel(baselines, plants, 'baseline_export.xlsx');
    toast.success('Export Excel généré');
  };

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }

  if (loading) return <PageWrapper><PageLoader /></PageWrapper>;

  const CC_ELEMENTS: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC'];

  const getTotalCC = (plantId: string): number => {
    if (isEditMode) return CC_ELEMENTS.reduce((s, el) => s + getDraftNumber(plantId, el), 0);
    const b = getBaselineForPlant(plantId);
    return b ? CC_ELEMENTS.reduce((s, el) => s + (b.costElements[el] ?? 0), 0) : 0;
  };

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEditMode && (
              <span className="flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1">
                <Pencil size={14} />
                Mode édition — modifications non sauvegardées
              </span>
            )}
            {(saving || isSaving) && (
              <span className="flex items-center gap-2 text-sm text-bp-secondary">
                <Save size={14} className="animate-pulse" /> Sauvegarde en cours...
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {isEditMode ? (
              <>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={isSaving}>
                  <Save size={14} />
                  Sauvegarder
                </button>
                <button onClick={cancelEditMode} className="btn-ghost flex items-center gap-2">
                  <X size={14} />
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button onClick={enterEditMode} className="btn-secondary flex items-center gap-2">
                  <Pencil size={14} />
                  Modifier
                </button>
                <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                  <Upload size={14} />
                  Importer Baseline Excel
                  <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                </label>
                <button onClick={handleExport} className="btn-ghost flex items-center gap-2">
                  <Download size={14} />
                  Exporter Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={`card p-0 overflow-hidden ${isEditMode ? 'ring-2 ring-amber-300' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold w-56">Nature de Coût</th>
                  <th className="text-right px-4 py-3 font-semibold w-36">Baseline Groupe</th>
                  {plants.map(p => (
                    <th key={p.id} className="text-right px-4 py-3 font-semibold w-32">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COST_ELEMENTS.map((el, i) => (
                  <tr key={el} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{COST_ELEMENT_LABELS[el]}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                      {formatNumber(getGroupTotal(el), locale)}
                    </td>
                    {plants.map(p => (
                      <td key={p.id} className="px-2 py-1.5">
                        {isEditMode ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input-cell"
                            value={getCellDisplay(p.id, el)}
                            onChange={(e) => handleCellChange(p.id, el, e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        ) : (
                          <span className="block text-right font-mono px-2">
                            {getCellDisplay(p.id, el)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Separator */}
                <tr className="bg-gray-100">
                  <td colSpan={2 + plants.length} className="px-4 py-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Totaux</span>
                  </td>
                </tr>

                {/* Total CC */}
                <tr className="bg-bp-primary/5 font-semibold">
                  <td className="px-4 py-2.5 text-bp-primary">Total CC</td>
                  <td className="px-4 py-2.5 text-right font-mono text-bp-primary">
                    {formatNumber(
                      isEditMode
                        ? plants.reduce((s, p) => s + getTotalCC(p.id), 0)
                        : baselines.reduce((s, b) => s + CC_ELEMENTS.reduce((ss, el) => ss + (b.costElements[el] ?? 0), 0), 0),
                      locale
                    )}
                  </td>
                  {plants.map(p => (
                    <td key={p.id} className="px-4 py-2.5 text-right font-mono text-bp-primary">
                      {formatNumber(getTotalCC(p.id), locale)}
                    </td>
                  ))}
                </tr>

                {/* Total Costs */}
                <tr className="bg-bp-primary/10 font-bold">
                  <td className="px-4 py-3 text-bp-primary">Total Costs</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-primary">
                    {formatNumber(
                      isEditMode
                        ? plants.reduce((s, p) => s + totalCostPerPlant(p.id), 0)
                        : baselines.reduce((s, b) => s + Object.values(b.costElements).reduce((ss, v) => ss + v, 0), 0),
                      locale
                    )}
                  </td>
                  {plants.map(p => (
                    <td key={p.id} className="px-4 py-3 text-right font-mono text-bp-primary">
                      {formatNumber(totalCostPerPlant(p.id), locale)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {plants.length === 0 && (
          <div className="card text-center py-8 text-gray-400">
            <p>Aucune usine configurée. Rendez-vous dans Administration pour ajouter des usines.</p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
