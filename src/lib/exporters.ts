import * as XLSX from 'xlsx';
import type { Lever } from '../types/lever';
import type { Baseline, CostElement } from '../types/baseline';
import { COST_ELEMENT_LABELS } from '../types/baseline';
import type { BaselineMatrix, BaselineVolumes } from '../types/baseline';

export function exportLeversToExcel(levers: Lever[], years: number[], filename = 'levers_export.xlsx') {
  const headers = [
    'ID', 'Platform', 'Plant ID', 'Department', 'Performance Lever', 'Source',
    'Improvement Structure', 'Lever Type', 'Digitalization/Mechanization',
    'In Budget', 'In Scope',
    ...years.map(y => `Savings ${y}`),
    'FY Cost Savings (LC)', 'CAPEX (LC)', 'Approved CAPEX (LC)', 'One-Off OPEX (LC)', 'Recurring OPEX (LC)', 'Net Savings (LC)',
    'FY Cost Savings (€)', 'CAPEX (€)', 'Approved CAPEX (€)', 'One-Off OPEX (€)', 'Recurring OPEX (€)', 'Net Savings (€)',
    'Payback', 'Benefits', 'Feasibility',
    'Commitment/Additional Potential/No Go', 'Comment',
    'FTE Savings Type', 'FTE',
    'Project Implementation Starting Date', 'Project Implementation Ending Date',
  ];

  const rows = levers.map(l => [
    l.leverId, l.platform, l.plantId, l.department, l.title, l.source,
    l.improvementStructure, l.leverType, l.digitalizationMechanization,
    l.inBudget ? 'Yes' : 'No', l.inScope ? 'Yes' : 'No',
    ...years.map(y => l.savingsByYear?.[String(y)] || 0),
    l.fyTotalSavingsLC, l.capexLC, l.approvedCapexLC, l.oneOffOpexLC, l.recurringOpexLC, l.netSavingsLC,
    l.fyTotalSavingsEUR, l.capexEUR, l.approvedCapexEUR, l.oneOffOpexEUR, l.recurringOpexEUR, l.netSavingsEUR,
    l.payback, l.benefits, l.feasibility,
    l.commitment, l.comment,
    l.fteSavingsType, l.fte,
    l.implementationStart, l.implementationEnd,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Levers');
  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------------
// Legacy baseline export (old per-plant format)
// ---------------------------------------------------------------------------

export function exportBaselineToExcel(
  baselines: Baseline[],
  plants: { id: string; name: string }[],
  filename = 'baseline_export.xlsx'
) {
  const plantHeaders = plants.map(p => p.name);
  const headers = ['Cost Element', 'Baseline Group', ...plantHeaders];

  const costElements: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];

  const rows = costElements.map(el => {
    const groupTotal = baselines.reduce((s, b) => s + (b.costElements[el] || 0), 0);
    const plantValues = plants.map(p => {
      const b = baselines.find(b => b.plantId === p.id);
      return b?.costElements[el] || 0;
    });
    return [COST_ELEMENT_LABELS[el], groupTotal, ...plantValues];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Baseline');
  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------------
// New v2 baseline exports — 4 separate sheets in one workbook
// ---------------------------------------------------------------------------

interface BaselineV2ExportConfig {
  costElement: BaselineMatrix | null;
  department: BaselineMatrix | null;
  fte: BaselineMatrix | null;
  volumes: BaselineVolumes | null;
  filename?: string;
}

export function exportBaselineV2ToExcel(config: BaselineV2ExportConfig) {
  const { costElement, department, fte, volumes } = config;
  const filename = config.filename ?? 'baseline_export.xlsx';
  const wb = XLSX.utils.book_new();

  // Sheet: Baseline - Cost Element
  if (costElement) {
    const ws = buildMatrixSheet(costElement, 'Cost structure / Cost element', false);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Cost Element');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No data']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Cost Element');
  }

  // Sheet: Baseline - Department
  if (department) {
    const ws = buildMatrixSheet(department, 'Cost structure / Department', true);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Department');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No data']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Department');
  }

  // Sheet: Baseline - FTE
  if (fte) {
    const ws = buildMatrixSheet(fte, 'Cost structure / Department (FTE)', true);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - FTE');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No data']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - FTE');
  }

  // Sheet: Baseline - Volumes
  if (volumes) {
    const ws = buildVolumesSheet(volumes);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Volumes');
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No data']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline - Volumes');
  }

  XLSX.writeFile(wb, filename);
}

/**
 * Build a sheet for cost_element / department / fte_department matrix.
 * departmentStyle: true = insert an empty row 1 before the header (department format).
 */
function buildMatrixSheet(matrix: BaselineMatrix, headerLabel: string, departmentStyle: boolean): XLSX.WorkSheet {
  const { plants, rows, referenceLabel } = matrix;
  const aoa: (string | number | null)[][] = [];

  if (departmentStyle) {
    // Row 0: empty separator
    aoa.push([null]);
  }

  // Header row: label | Baseline | Plant1 | Plant2 | ...
  aoa.push([headerLabel, 'Baseline', ...plants]);

  // Reference label row: empty | referenceLabel | empty | ...
  aoa.push([null, referenceLabel, ...plants.map(() => null)]);

  // Data rows
  for (const row of rows) {
    if (row.isCalculated) continue; // add calculated at end
    // Values are in euros raw → export in euros (k€ display is UI-only)
    aoa.push([row.label, row.total, ...plants.map(p => row.values[p] ?? 0)]);
  }

  // Calculated rows
  for (const row of rows) {
    if (!row.isCalculated) continue;
    aoa.push([row.label, row.total, ...plants.map(p => row.values[p] ?? 0)]);
  }

  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildVolumesSheet(volumes: BaselineVolumes): XLSX.WorkSheet {
  const { rows, referenceLabel } = volumes;

  const aoa: (string | number | null)[][] = [
    ['Platform', 'Plant', referenceLabel],
    ...rows.map(r => [r.platform, r.plant, r.volume]),
  ];

  // Total row
  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
  aoa.push([null, 'Total', totalVolume]);

  return XLSX.utils.aoa_to_sheet(aoa);
}
