import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, Save, X, Info, Plus, Trash2, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { useProjectStore } from '../store/projectStore';
import { useBaselineV2 } from '../hooks/useBaselineV2';
import { usePlants } from '../hooks/useProjects';
import {
  COST_ELEMENT_ROW_LABELS,
  DEPARTMENT_ROW_LABELS,
  CC_ROWS_COST_ELEMENT,
  CC_ROWS_DEPARTMENT,
  VOLUME_PLATFORMS,
  buildDefaultRows,
  recomputeCalculatedRows,
} from '../types/baseline';
import type {
  BaselineType,
  BaselineMatrix,
  BaselineMatrixRow,
  BaselineVolumes,
  BaselineVolumeRow,
} from '../types/baseline';
import {
  parseBaselineMatrixExcel,
  parseBaselineVolumesExcel,
  detectBaselineType,
} from '../lib/importers';
import { exportBaselineV2ToExcel } from '../lib/exporters';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type TabId = BaselineType;

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'cost_element', label: 'Cost Element' },
  { id: 'department', label: 'Department' },
  { id: 'fte_department', label: 'FTE / Department' },
  { id: 'volumes', label: 'Volumes' },
];

function fmtCost(v: number): string {
  if (!v) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v / 1000));
}

function fmtFTE(v: number): string {
  if (!v) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
}

function fmtVolume(v: number): string {
  if (!v) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v);
}

// ---------------------------------------------------------------------------
// Import help drawer content
// ---------------------------------------------------------------------------

const IMPORT_HELP: Record<TabId, React.ReactNode> = {
  cost_element: (
    <div className="text-sm space-y-3">
      <p className="font-semibold text-gray-800">Format attendu — Cost Element</p>
      <ul className="list-disc ml-4 space-y-1 text-gray-600">
        <li>Row 1 : <code className="bg-gray-100 px-1 rounded">Cost structure / Cost element</code> | <code className="bg-gray-100 px-1 rounded">Baseline</code> | [Plant1] | [Plant2] | …</li>
        <li>Row 2 : (vide) | <code className="bg-gray-100 px-1 rounded">Actual 2018</code> (ou autre label de référence) | …</li>
        <li>Rows 3+ : une ligne par cost element (RM, PM, DLC, etc.)</li>
        <li>Valeurs en <strong>euros</strong> (affichées en k€)</li>
      </ul>
      <p className="font-semibold text-gray-700 mt-3">Colonnes obligatoires :</p>
      <p className="text-gray-600 font-mono text-xs bg-gray-50 p-2 rounded">
        RM, PM, DLC, PILC, OVC, FC - Personal, Maintenance, OFC, RM Losses, PM Losses
      </p>
    </div>
  ),
  department: (
    <div className="text-sm space-y-3">
      <p className="font-semibold text-gray-800">Format attendu — Department</p>
      <ul className="list-disc ml-4 space-y-1 text-gray-600">
        <li>Row 1 : (vide) — ligne de séparation ignorée</li>
        <li>Row 2 : <code className="bg-gray-100 px-1 rounded">Cost structure / Department</code> | <code className="bg-gray-100 px-1 rounded">Baseline</code> | [Plant1] | …</li>
        <li>Row 3 : (vide) | <code className="bg-gray-100 px-1 rounded">Actual 2018</code> | …</li>
        <li>Rows 4+ : une ligne par département</li>
        <li>Valeurs en <strong>euros</strong> (affichées en k€)</li>
      </ul>
      <p className="font-semibold text-gray-700 mt-3">Colonnes obligatoires :</p>
      <p className="text-gray-600 font-mono text-xs bg-gray-50 p-2 rounded">
        RM, PM, Manufacturing, Supply Chain, Maintenance, Purchasing, Quality, GM, HR, IT, Finance, HSE, Engineering, RM Losses, PM Losses
      </p>
    </div>
  ),
  fte_department: (
    <div className="text-sm space-y-3">
      <p className="font-semibold text-gray-800">Format attendu — FTE / Department</p>
      <ul className="list-disc ml-4 space-y-1 text-gray-600">
        <li>Même structure que "Department"</li>
        <li>Row 2 : <code className="bg-gray-100 px-1 rounded">Cost structure / Department</code> | <code className="bg-gray-100 px-1 rounded">Baseline</code> | [Plant1] | …</li>
        <li>Rows 4+ : une ligne par département</li>
        <li>Valeurs = <strong>effectifs (FTE)</strong>, pas des euros</li>
      </ul>
      <p className="text-gray-500 text-xs mt-2">Note : si la détection automatique est ambiguë (même format que Department), une confirmation vous sera demandée.</p>
    </div>
  ),
  volumes: (
    <div className="text-sm space-y-3">
      <p className="font-semibold text-gray-800">Format attendu — Volumes</p>
      <ul className="list-disc ml-4 space-y-1 text-gray-600">
        <li>Row 1 : <code className="bg-gray-100 px-1 rounded">Platform</code> | <code className="bg-gray-100 px-1 rounded">Plant</code> | <code className="bg-gray-100 px-1 rounded">Volume A2018</code></li>
        <li>Rows 2+ : une ligne par plant</li>
        <li>Dernière ligne optionnelle de total (ignorée)</li>
      </ul>
      <p className="font-semibold text-gray-700 mt-3">Platforms reconnues :</p>
      <p className="text-gray-600 font-mono text-xs bg-gray-50 p-2 rounded">
        Processed Cheese, Hard Cheese, Fresh Cheese
      </p>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Import help drawer
// ---------------------------------------------------------------------------

interface ImportDrawerProps {
  type: TabId;
  isOpen: boolean;
  onClose: () => void;
  onFilePicked: (file: File) => void;
}

function ImportDrawer({ type, isOpen, onClose, onFilePicked }: ImportDrawerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="w-96 bg-white h-full shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="font-semibold text-gray-800">Aide à l'import Excel</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {IMPORT_HELP[type]}
        </div>
        <div className="px-5 py-4 border-t border-gray-200">
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            Sélectionner le fichier Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onFilePicked(file);
                onClose();
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation modal (before overwrite)
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ isOpen, message, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <p className="text-gray-800 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost">Annuler</button>
          <button onClick={onConfirm} className="btn-primary">Confirmer</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disambiguation modal (department vs fte_department)
// ---------------------------------------------------------------------------

interface DisambiguateModalProps {
  isOpen: boolean;
  onChoice: (type: 'department' | 'fte_department') => void;
  onCancel: () => void;
}

function DisambiguateModal({ isOpen, onChoice, onCancel }: DisambiguateModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <p className="text-gray-800 font-semibold mb-2">Type de données</p>
        <p className="text-gray-600 text-sm mb-5">
          Ce fichier semble contenir des données par département. S'agit-il de :
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => onChoice('department')}
            className="flex-1 btn-secondary text-center"
          >
            Coûts (k€)
          </button>
          <button
            onClick={() => onChoice('fte_department')}
            className="flex-1 btn-primary text-center"
          >
            Effectifs (FTE)
          </button>
        </div>
        <button onClick={onCancel} className="mt-3 btn-ghost w-full text-center">Annuler</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import preview modal
// ---------------------------------------------------------------------------

interface PreviewData {
  type: BaselineType;
  entry: BaselineMatrix | BaselineVolumes;
}

interface PreviewModalProps {
  isOpen: boolean;
  data: PreviewData | null;
  onConfirm: () => void;
  onCancel: () => void;
  hasExisting: boolean;
}

function PreviewModal({ isOpen, data, onConfirm, onCancel, hasExisting }: PreviewModalProps) {
  if (!isOpen || !data) return null;

  const isMatrix = data.type !== 'volumes';
  const matrix = isMatrix ? (data.entry as BaselineMatrix) : null;
  const volumes = !isMatrix ? (data.entry as BaselineVolumes) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Aperçu des données importées</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-auto">
          {matrix && (
            <>
              <p className="text-sm text-gray-500 mb-2">
                Label de référence : <strong>{matrix.referenceLabel}</strong> — {matrix.plants.length} plant(s) — {matrix.rows.filter(r => !r.isCalculated).length} lignes
              </p>
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1 border border-gray-200">Label</th>
                    {matrix.plants.slice(0, 5).map(p => (
                      <th key={p} className="text-right px-2 py-1 border border-gray-200">{p}</th>
                    ))}
                    {matrix.plants.length > 5 && <th className="px-2 py-1 border border-gray-200">…</th>}
                    <th className="text-right px-2 py-1 border border-gray-200">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.slice(0, 8).map(row => (
                    <tr key={row.label} className={row.isCalculated ? 'bg-bp-primary/5 font-semibold' : ''}>
                      <td className="px-2 py-1 border border-gray-200">{row.label}</td>
                      {matrix.plants.slice(0, 5).map(p => (
                        <td key={p} className="text-right px-2 py-1 border border-gray-200 font-mono">
                          {row.values[p] ?? 0}
                        </td>
                      ))}
                      {matrix.plants.length > 5 && <td className="px-2 py-1 border border-gray-200">…</td>}
                      <td className="text-right px-2 py-1 border border-gray-200 font-mono">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {volumes && (
            <>
              <p className="text-sm text-gray-500 mb-2">
                Label de référence : <strong>{volumes.referenceLabel}</strong> — {volumes.rows.length} ligne(s)
              </p>
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1 border border-gray-200">Platform</th>
                    <th className="text-left px-2 py-1 border border-gray-200">Plant</th>
                    <th className="text-right px-2 py-1 border border-gray-200">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.rows.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 border border-gray-200">{row.platform}</td>
                      <td className="px-2 py-1 border border-gray-200">{row.plant}</td>
                      <td className="text-right px-2 py-1 border border-gray-200 font-mono">{row.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {hasExisting && (
          <p className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠️ Des données existantes seront écrasées.
          </p>
        )}

        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onCancel} className="btn-ghost">Annuler</button>
          <button onClick={onConfirm} className="btn-primary flex items-center gap-2">
            <Upload size={14} />
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix editable tab (cost_element | department | fte_department)
// ---------------------------------------------------------------------------

interface MatrixTabProps {
  type: 'cost_element' | 'department' | 'fte_department';
  projectId: string;
  plants: { id: string; name: string }[];
  baseline: BaselineMatrix | null;
  saving: boolean;
  onSave: (entry: Omit<BaselineMatrix, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onImportRequest: () => void;
}

function MatrixTab({ type, projectId, plants, baseline, saving, onSave, onImportRequest }: MatrixTabProps) {
  const plantNames = plants.map(p => p.name);
  const isFTE = type === 'fte_department';
  const rowLabels = type === 'cost_element' ? COST_ELEMENT_ROW_LABELS : DEPARTMENT_ROW_LABELS;

  // Build initial rows from baseline or defaults
  const getInitialRows = (): BaselineMatrixRow[] => {
    if (baseline) return baseline.rows;
    return buildDefaultRows(type, plantNames);
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [draftRows, setDraftRows] = useState<BaselineMatrixRow[]>([]);
  const [referenceLabel, setReferenceLabel] = useState(baseline?.referenceLabel ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync referenceLabel when baseline loads
  React.useEffect(() => {
    setReferenceLabel(baseline?.referenceLabel ?? '');
  }, [baseline?.referenceLabel]);

  const enterEdit = () => {
    const rows = getInitialRows();
    // Ensure all plants are present in each row
    const syncedRows = rows.map(row => ({
      ...row,
      values: {
        ...Object.fromEntries(plantNames.map(p => [p, 0])),
        ...row.values,
      },
    }));
    setDraftRows(syncedRows);
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setDraftRows([]);
    setIsEditMode(false);
  };

  const handleCellChange = (rowLabel: string, plant: string, rawValue: string) => {
    const num = parseFloat(rawValue.replace(/\s/g, '').replace(',', '.'));
    const value = isNaN(num) ? 0 : (isFTE ? num : Math.round(num * 1000)); // k€ input → euros

    setDraftRows(prev => {
      const updated = prev.map(row => {
        if (row.label === rowLabel && !row.isCalculated) {
          const newValues = { ...row.values, [plant]: value };
          const newTotal = Object.values(newValues).reduce((s, v) => s + v, 0);
          return { ...row, values: newValues, total: newTotal };
        }
        return row;
      });
      return recomputeCalculatedRows(updated, type, plantNames);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalRows = recomputeCalculatedRows(draftRows, type, plantNames);
      await onSave({
        projectId,
        type,
        referenceLabel,
        rows: finalRows,
        plants: plantNames,
      });
      toast.success('Baseline sauvegardée');
      setIsEditMode(false);
      setDraftRows([]);
    } catch {
      // toast already shown
    } finally {
      setIsSaving(false);
    }
  };

  const displayRows = isEditMode ? draftRows : getInitialRows();

  // In view mode: for cost_element/department display k€, for fte display FTE
  const displayValue = (row: BaselineMatrixRow, plant: string): string => {
    const raw = row.values[plant] ?? 0;
    if (isFTE) return fmtFTE(raw);
    return fmtCost(raw); // ÷1000
  };

  const displayTotal = (row: BaselineMatrixRow): string => {
    if (isFTE) return fmtFTE(row.total);
    return fmtCost(row.total);
  };

  // In edit mode: input value in k€ or FTE
  const editValue = (row: BaselineMatrixRow, plant: string): string => {
    const raw = row.values[plant] ?? 0;
    if (isFTE) return raw === 0 ? '' : String(raw);
    return raw === 0 ? '' : String(raw / 1000); // display k€
  };

  const typeLabel = type === 'cost_element' ? 'Cost Element' : type === 'department' ? 'Department' : 'FTE / Department';
  const unit = isFTE ? '(FTE)' : '(k€)';

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">{typeLabel}</h3>
          {isEditMode ? (
            <input
              type="text"
              value={referenceLabel}
              onChange={e => setReferenceLabel(e.target.value)}
              placeholder="Label de référence (ex: Actual 2018)"
              className="text-sm border border-gray-300 rounded px-2 py-1 w-52"
            />
          ) : (
            baseline?.referenceLabel && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {baseline.referenceLabel}
              </span>
            )
          )}
          {(saving || isSaving) && (
            <span className="text-sm text-bp-secondary flex items-center gap-1">
              <Save size={12} className="animate-pulse" /> Sauvegarde…
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Save size={13} /> Sauvegarder
              </button>
              <button onClick={cancelEdit} className="btn-ghost flex items-center gap-2 text-sm">
                <X size={13} /> Annuler
              </button>
            </>
          ) : (
            <>
              <button onClick={enterEdit} className="btn-secondary text-sm">
                Modifier
              </button>
              <button
                onClick={onImportRequest}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                <Upload size={13} /> Importer Excel
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
                <th className="text-left px-4 py-3 font-semibold w-52">
                  {typeLabel} {unit}
                </th>
                <th className="text-right px-4 py-3 font-semibold w-32">Baseline</th>
                {plants.map(p => (
                  <th key={p.id} className="text-right px-4 py-3 font-semibold w-28">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const isCalc = row.isCalculated;
                const rowBg = isCalc
                  ? (row.label === 'Total Costs in k€' ? 'bg-bp-primary/10 font-bold' : 'bg-bp-primary/5 font-semibold')
                  : (i % 2 === 0 ? 'table-row-even' : 'table-row-odd');

                return (
                  <tr key={row.label} className={rowBg}>
                    <td className={`px-4 py-2 font-medium ${isCalc ? 'text-bp-primary' : 'text-gray-700'}`}>
                      {row.label}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">
                      {displayTotal(row)}
                    </td>
                    {plants.map(p => (
                      <td key={p.id} className="px-2 py-1">
                        {isEditMode && !isCalc ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input-cell"
                            value={editValue(row, p.name)}
                            onChange={e => handleCellChange(row.label, p.name, e.target.value)}
                            onFocus={e => e.target.select()}
                            placeholder="0"
                          />
                        ) : (
                          <span className={`block text-right font-mono px-2 ${isCalc ? 'text-bp-primary' : ''}`}>
                            {displayValue(row, p.name)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {plants.length === 0 && (
        <div className="card text-center py-8 text-gray-400 text-sm">
          Aucune usine configurée. Rendez-vous dans Administration pour ajouter des usines.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Volumes tab
// ---------------------------------------------------------------------------

interface VolumesTabProps {
  projectId: string;
  baseline: BaselineVolumes | null;
  saving: boolean;
  onSave: (rows: BaselineVolumeRow[], referenceLabel: string) => Promise<void>;
  onImportRequest: () => void;
}

function VolumesTab({ projectId, baseline, saving, onSave, onImportRequest }: VolumesTabProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftRows, setDraftRows] = useState<BaselineVolumeRow[]>([]);
  const [referenceLabel, setReferenceLabel] = useState(baseline?.referenceLabel ?? 'Volume A2018');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setReferenceLabel(baseline?.referenceLabel ?? 'Volume A2018');
  }, [baseline?.referenceLabel]);

  const enterEdit = () => {
    setDraftRows(baseline?.rows ? [...baseline.rows] : []);
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setDraftRows([]);
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draftRows, referenceLabel);
      toast.success('Volumes sauvegardés');
      setIsEditMode(false);
    } catch {
      // toast already shown
    } finally {
      setIsSaving(false);
    }
  };

  const addRow = () => {
    setDraftRows(prev => [...prev, { platform: VOLUME_PLATFORMS[0], plant: '', volume: 0 }]);
  };

  const removeRow = (idx: number) => {
    setDraftRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof BaselineVolumeRow, value: string | number) => {
    setDraftRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const displayRows = isEditMode ? draftRows : (baseline?.rows ?? []);
  const totalVolume = displayRows.reduce((s, r) => s + r.volume, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Volumes de production</h3>
          {isEditMode ? (
            <input
              type="text"
              value={referenceLabel}
              onChange={e => setReferenceLabel(e.target.value)}
              placeholder="Label (ex: Volume A2018)"
              className="text-sm border border-gray-300 rounded px-2 py-1 w-48"
            />
          ) : (
            baseline?.referenceLabel && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {baseline.referenceLabel}
              </span>
            )
          )}
          {(saving || isSaving) && (
            <span className="text-sm text-bp-secondary flex items-center gap-1">
              <Save size={12} className="animate-pulse" /> Sauvegarde…
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <button onClick={handleSave} disabled={isSaving} className="btn-primary flex items-center gap-2 text-sm">
                <Save size={13} /> Sauvegarder
              </button>
              <button onClick={cancelEdit} className="btn-ghost flex items-center gap-2 text-sm">
                <X size={13} /> Annuler
              </button>
            </>
          ) : (
            <>
              <button onClick={enterEdit} className="btn-secondary text-sm">Modifier</button>
              <button onClick={onImportRequest} className="btn-ghost flex items-center gap-2 text-sm">
                <Upload size={13} /> Importer Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`card p-0 overflow-hidden ${isEditMode ? 'ring-2 ring-amber-300' : ''}`}>
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-48">Platform</th>
              <th className="text-left px-4 py-3 font-semibold">Plant</th>
              <th className="text-right px-4 py-3 font-semibold w-36">{baseline?.referenceLabel || 'Volume'}</th>
              {isEditMode && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                <td className="px-2 py-1.5">
                  {isEditMode ? (
                    <select
                      value={row.platform}
                      onChange={e => updateRow(i, 'platform', e.target.value)}
                      className="input-cell"
                    >
                      {VOLUME_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value={row.platform}>{row.platform}</option>
                    </select>
                  ) : (
                    <span className="px-2">{row.platform}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isEditMode ? (
                    <input
                      type="text"
                      className="input-cell"
                      value={row.plant}
                      onChange={e => updateRow(i, 'plant', e.target.value)}
                      placeholder="Nom de l'usine"
                    />
                  ) : (
                    <span className="px-2">{row.plant}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isEditMode ? (
                    <input
                      type="number"
                      className="input-cell text-right"
                      value={row.volume || ''}
                      onChange={e => updateRow(i, 'volume', Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  ) : (
                    <span className="block text-right font-mono px-2">{fmtVolume(row.volume)}</span>
                  )}
                </td>
                {isEditMode && (
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Total row */}
            {displayRows.length > 0 && (
              <tr className="bg-bp-primary/10 font-bold">
                <td className="px-4 py-2 text-bp-primary" colSpan={2}>Total</td>
                <td className="px-4 py-2 text-right font-mono text-bp-primary">{fmtVolume(totalVolume)}</td>
                {isEditMode && <td />}
              </tr>
            )}
          </tbody>
        </table>

        {displayRows.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            Aucun volume saisi.
          </div>
        )}
      </div>

      {isEditMode && (
        <button onClick={addRow} className="btn-ghost flex items-center gap-2 text-sm">
          <Plus size={14} /> Ajouter une ligne
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Baseline page
// ---------------------------------------------------------------------------

export function BaselinePage() {
  const { selectedProjectId } = useProjectStore();
  const { baselines, isLoading, saving, saveBaseline, saveVolumes } = useBaselineV2(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);

  const [activeTab, setActiveTab] = useState<TabId>('cost_element');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [disambigOpen, setDisambigOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Export handler
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(() => {
    if (isLoading) {
      toast.error('Données en cours de chargement, réessayez dans un instant.');
      return;
    }

    const hasData =
      baselines.cost_element ||
      baselines.department ||
      baselines.fte_department ||
      baselines.volumes;

    if (!hasData) {
      toast.error("Aucune donnée baseline à exporter. Vérifiez que des données sont saisies dans l'onglet Baseline.");
      return;
    }

    try {
      exportBaselineV2ToExcel({
        costElement: baselines.cost_element as BaselineMatrix | null,
        department: baselines.department as BaselineMatrix | null,
        fte: baselines.fte_department as BaselineMatrix | null,
        volumes: baselines.volumes as BaselineVolumes | null,
        filename: `baseline_export_${selectedProjectId ?? 'projet'}.xlsx`,
      });
      toast.success('Export Excel généré avec succès');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [baselines, isLoading, selectedProjectId]);

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  const handleSaveMatrix = useCallback(async (
    type: 'cost_element' | 'department' | 'fte_department',
    entry: Omit<BaselineMatrix, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!selectedProjectId) return;
    await saveBaseline(selectedProjectId, type, entry);
  }, [selectedProjectId, saveBaseline]);

  const handleSaveVolumes = useCallback(async (rows: BaselineVolumeRow[], refLabel: string) => {
    if (!selectedProjectId) return;
    await saveVolumes(selectedProjectId, rows, refLabel);
  }, [selectedProjectId, saveVolumes]);

  // ---------------------------------------------------------------------------
  // Import flow
  // ---------------------------------------------------------------------------

  const processFile = useCallback(async (file: File, forcedType?: 'department' | 'fte_department') => {
    if (!selectedProjectId) return;
    const plantNames = plants.map(p => p.name);

    try {
      const detected = await detectBaselineType(file);

      if (detected === 'volumes') {
        const entry = await parseBaselineVolumesExcel(file, selectedProjectId);
        setPreviewData({ type: 'volumes', entry });
        setPreviewOpen(true);
        return;
      }

      if (detected === 'department_or_fte' && !forcedType) {
        // Store file for later and ask user
        setPendingFile(file);
        setDisambigOpen(true);
        return;
      }

      const finalType = forcedType ?? detected as 'cost_element' | 'department' | 'fte_department';
      const entry = await parseBaselineMatrixExcel(file, selectedProjectId, finalType, plantNames);
      setPreviewData({ type: finalType, entry });
      setPreviewOpen(true);
    } catch (err) {
      toast.error(`Erreur d'import: ${(err as Error).message}`);
    }
  }, [selectedProjectId, plants]);

  const handleFilePicked = useCallback((file: File) => {
    processFile(file);
  }, [processFile]);

  const handleDisambigChoice = useCallback((type: 'department' | 'fte_department') => {
    setDisambigOpen(false);
    if (pendingFile) {
      processFile(pendingFile, type);
      setPendingFile(null);
    }
  }, [pendingFile, processFile]);

  const handleImportConfirm = useCallback(async () => {
    if (!previewData || !selectedProjectId) return;
    setPreviewOpen(false);

    try {
      if (previewData.type === 'volumes') {
        const vol = previewData.entry as BaselineVolumes;
        await saveVolumes(selectedProjectId, vol.rows, vol.referenceLabel);
      } else {
        const matrix = previewData.entry as BaselineMatrix;
        await saveBaseline(selectedProjectId, previewData.type, {
          projectId: selectedProjectId,
          type: previewData.type as 'cost_element' | 'department' | 'fte_department',
          referenceLabel: matrix.referenceLabel,
          rows: matrix.rows,
          plants: matrix.plants,
        });
      }
      toast.success('Import réussi');
      // Switch to the imported tab
      setActiveTab(previewData.type);
    } catch {
      // toast already shown
    }
    setPreviewData(null);
  }, [previewData, selectedProjectId, saveBaseline, saveVolumes]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!selectedProjectId) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-48 text-gray-400">
          Sélectionnez un projet
        </div>
      </PageWrapper>
    );
  }

  if (isLoading) return <PageWrapper><PageLoader /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* Tabs + Export button */}
        <div className="flex items-center border-b border-gray-200">
          <div className="flex flex-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-bp-primary text-bp-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 mb-px text-sm font-medium text-gray-600 hover:text-bp-primary transition-colors"
            title="Exporter toutes les baselines en Excel"
          >
            <Download size={15} />
            Exporter Excel
          </button>
        </div>

        {/* Tab content */}
        {(activeTab === 'cost_element' || activeTab === 'department' || activeTab === 'fte_department') && (
          <MatrixTab
            key={activeTab}
            type={activeTab}
            projectId={selectedProjectId}
            plants={plants}
            baseline={baselines[activeTab] as BaselineMatrix | null}
            saving={saving}
            onSave={(entry) => handleSaveMatrix(activeTab, entry)}
            onImportRequest={() => setDrawerOpen(true)}
          />
        )}

        {activeTab === 'volumes' && (
          <VolumesTab
            projectId={selectedProjectId}
            baseline={baselines.volumes as BaselineVolumes | null}
            saving={saving}
            onSave={handleSaveVolumes}
            onImportRequest={() => setDrawerOpen(true)}
          />
        )}
      </div>

      {/* Import drawer */}
      <ImportDrawer
        type={activeTab}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onFilePicked={handleFilePicked}
      />

      {/* Disambiguation modal */}
      <DisambiguateModal
        isOpen={disambigOpen}
        onChoice={handleDisambigChoice}
        onCancel={() => { setDisambigOpen(false); setPendingFile(null); }}
      />

      {/* Preview modal */}
      <PreviewModal
        isOpen={previewOpen}
        data={previewData}
        hasExisting={!!previewData && !!baselines[previewData.type]}
        onConfirm={handleImportConfirm}
        onCancel={() => { setPreviewOpen(false); setPreviewData(null); }}
      />
    </PageWrapper>
  );
}
