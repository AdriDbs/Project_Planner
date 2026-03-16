import * as XLSX from 'xlsx';
import type { Lever } from '../types/lever';
import type { Baseline, CostElement } from '../types/baseline';
import { COST_ELEMENT_LABELS } from '../types/baseline';
import type { BaselineMatrix, BaselineVolumes } from '../types/baseline';

// ---------------------------------------------------------------------------
// Utility: convert 0-based column index to Excel letter(s) (A, B, ..., Z, AA, ...)
// ---------------------------------------------------------------------------

function colLetter(colIndex: number): string {
  let letter = '';
  let n = colIndex + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Apply #,##0 number format to all numeric cells in a worksheet
function applyNumberFormat(ws: XLSX.WorkSheet, format = '#,##0') {
  Object.keys(ws).forEach(cellRef => {
    if (cellRef[0] === '!') return;
    const cell = ws[cellRef];
    if (cell.t === 'n' && !cell.z) {
      cell.z = format;
    }
  });
}

// ---------------------------------------------------------------------------
// Levers export
// ---------------------------------------------------------------------------

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

  // Column indices for EUR section (0-based):
  // headers[0..10] = ID..InScope (11 cols)
  // headers[11..10+years.length] = Savings by year
  // After years: FY LC, CAPEX LC, ApprovedCAPEX LC, OneOff LC, Recurring LC, Net LC (6 cols LC)
  // Then EUR section starts at index: 11 + years.length + 6
  const eurSectionStart = 11 + years.length + 6; // = index of 'FY Cost Savings (€)'
  // EUR columns: FYSavings=eurSectionStart, CAPEX=+1, ApprovedCAPEX=+2, OneOff=+3, Recurring=+4, NetSavings=+5
  const fyEurIdx   = eurSectionStart;
  const oneOffIdx  = eurSectionStart + 3;
  const recurIdx   = eurSectionStart + 4;
  const netIdx     = eurSectionStart + 5;

  const fyEurCol  = colLetter(fyEurIdx);
  const oneOffCol = colLetter(oneOffIdx);
  const recurCol  = colLetter(recurIdx);
  const netCol    = colLetter(netIdx);

  const rows = levers.map((l, rowIdx) => {
    const excelRow = rowIdx + 2; // row 1 = headers
    return [
      l.leverId, l.platform, l.plantId, l.department, l.title, l.source,
      l.improvementStructure, l.leverType, l.digitalizationMechanization,
      l.inBudget ? 'Yes' : 'No', l.inScope ? 'Yes' : 'No',
      ...years.map(y => l.savingsByYear?.[String(y)] || 0),
      l.fyTotalSavingsLC, l.capexLC, l.approvedCapexLC, l.oneOffOpexLC, l.recurringOpexLC, l.netSavingsLC,
      l.fyTotalSavingsEUR, l.capexEUR, l.approvedCapexEUR, l.oneOffOpexEUR, l.recurringOpexEUR,
      // Net Savings (€) = FY Cost Savings (€) - One-Off OPEX (€) - Recurring OPEX (€)
      { t: 'n' as const, v: l.netSavingsEUR ?? 0, f: `${fyEurCol}${excelRow}-${oneOffCol}${excelRow}-${recurCol}${excelRow}` },
      l.payback, l.benefits, l.feasibility,
      l.commitment, l.comment,
      l.fteSavingsType, l.fte,
      l.implementationStart, l.implementationEnd,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Format numeric EUR columns
  for (let i = 0; i < levers.length; i++) {
    const excelRow = i + 2;
    for (let ci = fyEurIdx; ci <= netIdx; ci++) {
      const ref = `${colLetter(ci)}${excelRow}`;
      if (ws[ref] && ws[ref].t === 'n') ws[ref].z = '#,##0';
    }
  }
  // Net savings column header hint
  if (ws[`${netCol}1`]) ws[`${netCol}1`].c = [{ a: 'auto', t: `=${fyEurCol}-${oneOffCol}-${recurCol}` }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Levers');
  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------------
// Legacy baseline export (old per-plant format) — fixed plantId lookup
// ---------------------------------------------------------------------------

export function exportBaselineToExcel(
  baselines: Baseline[],
  plants: { id: string; name: string }[],
  filename = 'baseline_export.xlsx'
) {
  const plantHeaders = plants.map(p => p.name);
  const headers = ['Cost Element', 'Baseline Group', ...plantHeaders];

  const costElements: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];

  const rows = costElements.map((el, rowIdx) => {
    const excelRow = rowIdx + 2; // row 1 = headers
    const groupTotal = baselines.reduce((s, b) => s + (b.costElements?.[el] ?? 0), 0);
    const plantValues = plants.map(p => {
      // Match by plantId OR by composite id `${projectId}_${plantId}` (upsert fix compatibility)
      const b = baselines.find(
        b => b.plantId === p.id || b.id === `${b.projectId}_${p.id}`
      );
      return b?.costElements?.[el] ?? 0;
    });

    // Column B = Baseline Group = SUM of plant columns
    const firstPlantCol = colLetter(2);  // C
    const lastPlantCol  = colLetter(1 + plants.length);
    const sumFormula    = plants.length > 0
      ? `SUM(${firstPlantCol}${excelRow}:${lastPlantCol}${excelRow})`
      : undefined;

    return [
      COST_ELEMENT_LABELS[el],
      sumFormula
        ? { t: 'n' as const, v: groupTotal, f: sumFormula }
        : groupTotal,
      ...plantValues,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyNumberFormat(ws);
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

// ---------------------------------------------------------------------------
// Row offset map for cost_element sheet (1-based Excel rows, accounting for header rows)
// departmentStyle=false: row1=header, row2=referenceLabel, data starts row3
// departmentStyle=true:  row1=empty, row2=header, row3=referenceLabel, data starts row4
// ---------------------------------------------------------------------------

// For cost_element (departmentStyle=false):
// Headers at row 1, referenceLabel at row 2, data rows from row 3
// RM=3, PM=4, DLC=5, PILC=6, OVC=7, FC-Personal=8, Maintenance=9, OFC=10, RM Losses=11, PM Losses=12
// Total CC = 13, Total Costs = 14

const COST_ELEMENT_ROW_OFFSET = 3; // first data row (1-based)

// CC rows for cost_element (relative row numbers from first data row, 0-indexed)
// DLC=index2, PILC=3, OVC=4, FC-Personal=5, Maintenance=6, OFC=7
const CC_INDICES_COST_ELEMENT = [2, 3, 4, 5, 6, 7];

// For department (departmentStyle=true, data starts row 4):
// RM=4, PM=5, Manufacturing=6, SupplyChain=7, Maintenance=8, Purchasing=9,
// Quality=10, GM=11, HR=12, IT=13, Finance=14, HSE=15, Engineering=16,
// RM Losses=17, PM Losses=18
// Total CC = 19, Total Costs = 20
const DEPARTMENT_ROW_OFFSET = 4;

// CC indices for department: Manufacturing(2)..Engineering(12)
const CC_INDICES_DEPARTMENT = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Build a sheet for cost_element / department / fte_department matrix.
 * departmentStyle: true = insert an empty row 1 before the header (department format).
 * Adds Excel SUM formulas for the Baseline (total) column and Total CC / Total Costs rows.
 */
function buildMatrixSheet(matrix: BaselineMatrix, headerLabel: string, departmentStyle: boolean): XLSX.WorkSheet {
  const { plants, rows, referenceLabel } = matrix;
  const isFte = matrix.type === 'fte_department';
  const numFormat = isFte ? '#,##0.0' : '#,##0';

  // Determine row offsets
  const dataStartRow = departmentStyle ? DEPARTMENT_ROW_OFFSET : COST_ELEMENT_ROW_OFFSET;
  const ccIndices    = departmentStyle ? CC_INDICES_DEPARTMENT : CC_INDICES_COST_ELEMENT;

  // Separate non-calculated and calculated rows
  const dataRows   = rows.filter(r => !r.isCalculated);
  const calcRows   = rows.filter(r => r.isCalculated);

  // Plant columns: col B = Baseline total (index 1), col C+ = plants (index 2+)
  const totalColLetter    = colLetter(1); // B
  const firstPlantColIdx  = 2;
  const lastPlantColIdx   = 1 + plants.length;
  const lastPlantCol      = colLetter(lastPlantColIdx);

  type AoaCell = string | number | null | { t: 'n'; v: number; f: string };
  const aoa: AoaCell[][] = [];

  if (departmentStyle) {
    aoa.push([null]);
  }

  // Header row
  aoa.push([headerLabel, 'Baseline', ...plants]);
  // Reference label row
  aoa.push([null, referenceLabel, ...plants.map(() => null)]);

  // Data rows (non-calculated) — with SUM formula on Baseline column
  dataRows.forEach((row, idx) => {
    const excelRow = dataStartRow + idx;
    const firstPlantCol = colLetter(firstPlantColIdx);
    const sumFormula = plants.length > 0
      ? `SUM(${firstPlantCol}${excelRow}:${lastPlantCol}${excelRow})`
      : undefined;

    aoa.push([
      row.label,
      sumFormula
        ? { t: 'n', v: row.total, f: sumFormula }
        : row.total,
      ...plants.map(p => row.values[p] ?? 0),
    ]);
  });

  // Calculated rows (Total CC, Total Costs) — with cross-row formulas
  const totalCCRowExcel    = dataStartRow + dataRows.length;
  const totalCostsRowExcel = totalCCRowExcel + 1;

  // Total CC formula: sum of CC row values in each column
  const buildTotalCCFormula = (col: string): string => {
    const ccRows = ccIndices.map(i => `${col}${dataStartRow + i}`);
    return ccRows.join('+');
  };

  // Total Costs formula: RM (row 0) + PM (row 1) + Total CC
  const buildTotalCostsFormula = (col: string): string =>
    `${col}${dataStartRow}+${col}${dataStartRow + 1}+${col}${totalCCRowExcel}`;

  // Collect all columns that need formulas: B + plant columns
  const allCols = [
    totalColLetter,
    ...plants.map((_, i) => colLetter(firstPlantColIdx + i)),
  ];

  // Total CC row — use formulas if we have data rows, otherwise fallback values
  const totalCCRow = calcRows.find(r => r.label.toLowerCase().includes('total cc'));
  if (totalCCRow || calcRows.length > 0) {
    const row = totalCCRow ?? calcRows[0];
    aoa.push([
      row.label,
      ...allCols.map((col, ci) => {
        const fallback = ci === 0 ? row.total : (row.values[plants[ci - 1]] ?? 0);
        return dataRows.length > 0
          ? { t: 'n' as const, v: fallback, f: buildTotalCCFormula(col) }
          : fallback;
      }),
    ]);
  }

  // Total Costs row
  const totalCostsRow = calcRows.find(r => r.label.toLowerCase().includes('total cost'));
  if (totalCostsRow || calcRows.length > 1) {
    const row = totalCostsRow ?? calcRows[1];
    aoa.push([
      row.label,
      ...allCols.map((col, ci) => {
        const fallback = ci === 0 ? row.total : (row.values[plants[ci - 1]] ?? 0);
        return dataRows.length > 0
          ? { t: 'n' as const, v: fallback, f: buildTotalCostsFormula(col) }
          : fallback;
      }),
    ]);
  }

  // Any extra calculated rows beyond Total CC and Total Costs
  calcRows.slice(2).forEach(row => {
    aoa.push([row.label, row.total, ...plants.map(p => row.values[p] ?? 0)]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]);
  applyNumberFormat(ws, numFormat);
  return ws;
}

function buildVolumesSheet(volumes: BaselineVolumes): XLSX.WorkSheet {
  const { rows, referenceLabel } = volumes;

  type AoaCell = string | number | null | { t: 'n'; v: number; f: string };
  const aoa: AoaCell[][] = [
    ['Platform', 'Plant', referenceLabel],
    ...rows.map(r => [r.platform, r.plant, r.volume] as AoaCell[]),
  ];

  // Total row — formula SUM of volume column
  const firstDataRow = 2;
  const lastDataRow  = 1 + rows.length;
  const totalVolume  = rows.reduce((s, r) => s + r.volume, 0);
  aoa.push([
    null,
    'Total',
    rows.length > 0
      ? { t: 'n', v: totalVolume, f: `SUM(C${firstDataRow}:C${lastDataRow})` }
      : totalVolume,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]);
  applyNumberFormat(ws);
  return ws;
}
