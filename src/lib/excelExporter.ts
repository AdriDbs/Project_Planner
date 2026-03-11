/**
 * BBACM Project Planner — Excel Exporter
 *
 * Generates a fully-formatted .xlsx file with 9 sheets using xlsx-js-style.
 * All generation runs client-side; no backend required.
 */
import * as XLSX from 'xlsx-js-style';
import type { Project, Plant } from '../types/project';
import type { Lever } from '../types/lever';
import type { Baseline, CostElement } from '../types/baseline';
import {
  IMPROVEMENT_STRUCTURES_ORDERED,
  DEPARTMENTS_ORDERED,
  STRUCTURE_TO_COST_ELEMENT,
  STRUCTURE_DISPLAY,
  aggregateByStructure,
  aggregateByDepartment,
  calcAnnualPhasing,
  calcCumulatedPhasing,
  calcFTEPhasing,
  calcCapexPhasing,
  calcCumulatedCapexPhasing,
  getTotalBaselineCosts,
  getTotalConversionCost,
} from './excelCalculations';

// ---------------------------------------------------------------------------
// Style definitions
// ---------------------------------------------------------------------------

type XLStyle = Record<string, unknown>;

const S: Record<string, XLStyle> = {
  headerDark: {
    fill: { fgColor: { rgb: '003057' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  },
  headerMid: {
    fill: { fgColor: { rgb: '00A3E0' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  },
  headerLight: {
    fill: { fgColor: { rgb: 'D9E8F5' } },
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  },
  title: {
    fill: { fgColor: { rgb: '003057' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  total: {
    fill: { fgColor: { rgb: 'E8F0FE' } },
    font: { bold: true, sz: 10 },
  },
  totalRight: {
    fill: { fgColor: { rgb: 'E8F0FE' } },
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'right' },
  },
  rowEven: {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { sz: 9 },
  },
  rowOdd: {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { sz: 9 },
  },
  rowEvenRight: {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  rowOddRight: {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  commitment: {
    fill: { fgColor: { rgb: 'DCFCE7' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  additional: {
    fill: { fgColor: { rgb: 'FEF9C3' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  number: {
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  percent: {
    font: { sz: 9 },
    alignment: { horizontal: 'center' },
  },
  label: {
    font: { bold: true, sz: 10 },
  },
  sectionTitle: {
    fill: { fgColor: { rgb: '003057' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
  },
  capexRow: {
    fill: { fgColor: { rgb: 'DBEAFE' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  approvedCapexRow: {
    fill: { fgColor: { rgb: 'DCFCE7' } },
    font: { sz: 9 },
    alignment: { horizontal: 'right' },
  },
  empty: {},
};

// ---------------------------------------------------------------------------
// Low-level worksheet helpers
// ---------------------------------------------------------------------------

function makeWs(): XLSX.WorkSheet {
  return { '!ref': 'A1:A1', '!merges': [], '!cols': [], '!rows': [] };
}

function c(
  value: string | number | null | undefined,
  style: XLStyle = S.empty,
  numFmt?: string,
): XLSX.CellObject {
  if (value === null || value === undefined || value === '') {
    return { v: '', t: 's', s: style } as XLSX.CellObject;
  }
  if (typeof value === 'number') {
    const cell = { v: value, t: 'n', s: style, z: numFmt } as XLSX.CellObject;
    return cell;
  }
  return { v: value, t: 's', s: style } as XLSX.CellObject;
}

function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  cell: XLSX.CellObject,
): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = cell;
}

function setVal(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number | null | undefined,
  style: XLStyle = S.empty,
  numFmt?: string,
): void {
  setCell(ws, row, col, c(value, style, numFmt));
}

function merge(
  ws: XLSX.WorkSheet,
  rStart: number,
  cStart: number,
  rEnd: number,
  cEnd: number,
): void {
  if (!ws['!merges']) ws['!merges'] = [];
  (ws['!merges'] as XLSX.Range[]).push({
    s: { r: rStart, c: cStart },
    e: { r: rEnd, c: cEnd },
  });
}

function setRange(ws: XLSX.WorkSheet, maxRow: number, maxCol: number): void {
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
}

function setCols(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function setRowHeight(ws: XLSX.WorkSheet, row: number, height: number): void {
  if (!ws['!rows']) ws['!rows'] = [];
  (ws['!rows'] as Record<string, number>[])[row] = { hpt: height };
}

function n(val: number | undefined | null): number {
  return val || 0;
}

function fmt(v: number): string {
  return '#,##0';
}

function pct(): string {
  return '0.0%';
}

function dateFmt(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

function monthFromDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return String(d.getMonth() + 1);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Sheet 1: Performance Levers
// ---------------------------------------------------------------------------

function buildPerformanceLeversSheet(
  project: Project,
  plants: Plant[],
  levers: Lever[],
  years: number[],
): XLSX.WorkSheet {
  const ws = makeWs();

  // Plant lookup
  const plantMap = new Map(plants.map(p => [p.id, p]));
  // Reference year for "In B[year] & in-scope" column
  const refYear = years[0] ? String(years[0]) : '';

  // --- Row 0 (A1): Title ---
  setVal(ws, 0, 0, `${project.name} Project Planner`, S.title);
  merge(ws, 0, 0, 0, 7);
  setRowHeight(ws, 0, 30);

  // --- Row 4 (headers) ---
  const headers = [
    'ID', 'Platform', 'Plant', 'Department', 'Performance Lever', 'Source',
    'Improvement Structure', 'Lever Type', 'Digitalization / Mechanization',
    'In Budget', 'In Scope', `In B${refYear} & in-scope`,
    ...years.map(y => `Savings ${y}`),
    'FY Cost Savings (LC)', 'CAPEX (LC)', 'Approved CAPEX (LC)',
    'One-Off OPEX (LC)', 'Recurring OPEX (LC)', 'Net Savings (LC)',
    'FY Cost Savings (€)', 'CAPEX (€)', 'Approved CAPEX (€)',
    'One-Off OPEX (€)', 'Recurring OPEX (€)', 'Net Savings (€)',
    'Payback', 'Benefits', 'Feasibility',
    'Commitment/Additional Potential/No Go', 'Comment',
    'FTE Savings Type', 'FTE', 'OEE or FTE',
    'GY 1', 'GY 2', 'GY 3',
    'OEE 1', 'OEE 2', 'OEE 3',
    'H/T 1', 'H/T 2', 'H/T 3',
    'RM Losses', 'PM Losses',
    'Project Implementation Starting Date', 'Project Implementation Starting Month',
    'Project Implementation Ending Date', 'Project Duration',
    'CAPEX Impact Year', 'KPI Impact Year',
  ];

  const HEADER_ROW = 4;
  headers.forEach((h, ci) => {
    setVal(ws, HEADER_ROW, ci, h, S.headerDark);
  });
  setRowHeight(ws, HEADER_ROW, 30);

  // --- Data rows from row 5 ---
  levers.forEach((lever, idx) => {
    const row = HEADER_ROW + 1 + idx;
    const st = idx % 2 === 0 ? S.rowEven : S.rowOdd;
    const stR = idx % 2 === 0 ? S.rowEvenRight : S.rowOddRight;
    const plant = plantMap.get(lever.plantId);
    const plantName = plant?.name || lever.plantId || '';
    const inBudgetAndScope = lever.inBudget && lever.inScope ? 'Yes' : 'No';

    let ci = 0;
    setVal(ws, row, ci++, lever.leverId || lever.id, st);
    setVal(ws, row, ci++, lever.platform || '', st);
    setVal(ws, row, ci++, plantName, st);
    setVal(ws, row, ci++, lever.department || '', st);
    setVal(ws, row, ci++, lever.title || '', st);
    setVal(ws, row, ci++, lever.source || '', st);
    setVal(ws, row, ci++, lever.improvementStructure || '', st);
    setVal(ws, row, ci++, lever.leverType || '', st);
    setVal(ws, row, ci++, lever.digitalizationMechanization || '', st);
    setVal(ws, row, ci++, lever.inBudget ? 'Yes' : 'No', st);
    setVal(ws, row, ci++, lever.inScope ? 'Yes' : 'No', st);
    setVal(ws, row, ci++, inBudgetAndScope, st);

    // Savings by year
    for (const year of years) {
      setVal(ws, row, ci++, n(lever.savingsByYear?.[String(year)]), stR, fmt(0));
    }

    // Financial LC
    setVal(ws, row, ci++, n(lever.fyTotalSavingsLC), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.capexLC), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.approvedCapexLC), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.oneOffOpexLC), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.recurringOpexLC), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.netSavingsLC), stR, fmt(0));

    // Financial EUR
    setVal(ws, row, ci++, n(lever.fyTotalSavingsEUR), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.capexEUR), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.approvedCapexEUR), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.oneOffOpexEUR), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.recurringOpexEUR), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.netSavingsEUR), stR, fmt(0));

    setVal(ws, row, ci++, n(lever.payback), stR, '0.0');
    setVal(ws, row, ci++, n(lever.benefits), stR, '0');
    setVal(ws, row, ci++, n(lever.feasibility), stR, '0');
    setVal(ws, row, ci++, lever.commitment || '', st);
    setVal(ws, row, ci++, lever.comment || '', st);
    setVal(ws, row, ci++, lever.fteSavingsType || '', st);
    setVal(ws, row, ci++, n(lever.fte), stR, fmt(0));
    setVal(ws, row, ci++, lever.oeeOrFte || '', st);

    // GY, OEE, H/T (3 each)
    for (let i = 0; i < 3; i++) setVal(ws, row, ci++, n(lever.gy?.[i]), stR, '0.0');
    for (let i = 0; i < 3; i++) setVal(ws, row, ci++, n(lever.oee?.[i]), stR, '0.0');
    for (let i = 0; i < 3; i++) setVal(ws, row, ci++, n(lever.ht?.[i]), stR, '0.0');

    setVal(ws, row, ci++, n(lever.rmLosses), stR, fmt(0));
    setVal(ws, row, ci++, n(lever.pmLosses), stR, fmt(0));
    setVal(ws, row, ci++, dateFmt(lever.implementationStart), st);
    setVal(ws, row, ci++, monthFromDate(lever.implementationStart), stR);
    setVal(ws, row, ci++, dateFmt(lever.implementationEnd), st);
    setVal(ws, row, ci++, n(lever.projectDurationMonths), stR, '0');
    setVal(ws, row, ci++, lever.capexImpactYear || '', st);
    setVal(ws, row, ci++, lever.kpiImpactYear || '', st);
  });

  const lastRow = HEADER_ROW + levers.length;
  const lastCol = headers.length - 1;
  setRange(ws, lastRow, lastCol);

  // Column widths
  const colWidths = [
    8, 18, 15, 16, 45, 14, 18, 22, 22, 10, 10, 14,
    ...years.map(() => 14),
    14, 14, 16, 14, 16, 14, // LC
    14, 14, 16, 14, 16, 14, // EUR
    10, 10, 10, 18, 30,     // Payback, Benefits, Feasibility, Commitment, Comment
    14, 8, 12,              // FTE type, FTE, OEE/FTE
    9, 9, 9,                // GY
    9, 9, 9,                // OEE
    9, 9, 9,                // H/T
    12, 12,                 // RM/PM Losses
    18, 10, 18, 14, 14, 14, // Dates
  ];
  setCols(ws, colWidths);

  return ws;
}

// ---------------------------------------------------------------------------
// Helper: build a cost structure block (Executive Summary)
// ---------------------------------------------------------------------------

function writeCostBlock(
  ws: XLSX.WorkSheet,
  startRow: number,
  title: string,
  groups: string[],
  aggregation: Record<string, { commitment: { netSavings: number; capex: number }; additional: { netSavings: number; capex: number }; full: { netSavings: number; capex: number } }>,
  numCols: number,
): number {
  // Title row
  setVal(ws, startRow, 0, title, S.sectionTitle);
  merge(ws, startRow, 0, startRow, numCols - 1);

  // Blank row
  const subHeaderRow = startRow + 2;
  setVal(ws, subHeaderRow, 0, 'Automatic calculation', S.label);

  const hRow = startRow + 4;
  // Main headers
  const colHeaders = [
    'Nature of costs',
    'Commitment', '', 'CAPEX',
    'Additional Potential', '', 'CAPEX',
    'Full Potential', 'CAPEX',
  ];
  colHeaders.forEach((h, ci) => {
    setVal(ws, hRow, ci, h, S.headerDark);
  });
  setRowHeight(ws, hRow, 25);

  // Sub-headers
  const subRow = hRow + 1;
  const subCols = ['', 'Net Savings', '', 'CAPEX', 'Net Savings', '', 'CAPEX', 'Net Savings', 'CAPEX'];
  subCols.forEach((h, ci) => {
    setVal(ws, subRow, ci, h, S.headerLight);
  });

  // Data rows
  let dataRow = subRow + 1;
  let totNetCommit = 0, totCapexCommit = 0;
  let totNetAdd = 0, totCapexAdd = 0;
  let totNetFull = 0, totCapexFull = 0;

  for (const group of groups) {
    const ag = aggregation[group] || { commitment: { netSavings: 0, capex: 0 }, additional: { netSavings: 0, capex: 0 }, full: { netSavings: 0, capex: 0 } };
    const st = S.rowEven;
    const stR = S.rowEvenRight;

    setVal(ws, dataRow, 0, STRUCTURE_DISPLAY[group] || group, st);
    setVal(ws, dataRow, 1, n(ag.commitment.netSavings), S.commitment, fmt(0));
    setVal(ws, dataRow, 2, null, st);
    setVal(ws, dataRow, 3, n(ag.commitment.capex), S.commitment, fmt(0));
    setVal(ws, dataRow, 4, n(ag.additional.netSavings), S.additional, fmt(0));
    setVal(ws, dataRow, 5, null, st);
    setVal(ws, dataRow, 6, n(ag.additional.capex), S.additional, fmt(0));
    setVal(ws, dataRow, 7, n(ag.full.netSavings), stR, fmt(0));
    setVal(ws, dataRow, 8, n(ag.full.capex), stR, fmt(0));

    totNetCommit += n(ag.commitment.netSavings);
    totCapexCommit += n(ag.commitment.capex);
    totNetAdd += n(ag.additional.netSavings);
    totCapexAdd += n(ag.additional.capex);
    totNetFull += n(ag.full.netSavings);
    totCapexFull += n(ag.full.capex);
    dataRow++;
  }

  // Total row
  setVal(ws, dataRow, 0, 'Total', S.total);
  setVal(ws, dataRow, 1, totNetCommit, S.totalRight, fmt(0));
  setVal(ws, dataRow, 2, null, S.total);
  setVal(ws, dataRow, 3, totCapexCommit, S.totalRight, fmt(0));
  setVal(ws, dataRow, 4, totNetAdd, S.totalRight, fmt(0));
  setVal(ws, dataRow, 5, null, S.total);
  setVal(ws, dataRow, 6, totCapexAdd, S.totalRight, fmt(0));
  setVal(ws, dataRow, 7, totNetFull, S.totalRight, fmt(0));
  setVal(ws, dataRow, 8, totCapexFull, S.totalRight, fmt(0));

  return dataRow + 1;
}

// ---------------------------------------------------------------------------
// Sheet 2: Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummarySheet(levers: Lever[]): XLSX.WorkSheet {
  const ws = makeWs();
  const inScopeLevers = levers.filter(l => l.inScope);

  const byStructure = aggregateByStructure(inScopeLevers);
  const byDept = aggregateByDepartment(inScopeLevers);

  // Bloc 1 — Cost Structure
  const nextRow = writeCostBlock(ws, 0, 'Executive summary - Cost structure ! Do not modify the table below !', IMPROVEMENT_STRUCTURES_ORDERED, byStructure, 9);

  // Bloc 2 — Department (starts at row ~21)
  const bloc2Start = Math.max(nextRow + 2, 20);
  const DEPT_GROUPS = [
    'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality',
    'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering',
  ];
  writeCostBlock(ws, bloc2Start, 'Executive summary - Department', DEPT_GROUPS, byDept, 9);

  setRange(ws, bloc2Start + 20, 8);
  setCols(ws, [22, 16, 10, 14, 16, 10, 14, 16, 14]);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 3: Synthesis
// ---------------------------------------------------------------------------

function buildSynthesisSheet(
  project: Project,
  plants: Plant[],
  levers: Lever[],
  baselines: Baseline[],
  years: number[],
): XLSX.WorkSheet {
  const ws = makeWs();
  const inScopeLevers = levers.filter(l => l.inScope);
  const commitLevers = levers.filter(l => l.commitment === 'Commitment');

  // Section 1 — Baseline Elements
  setVal(ws, 0, 0, 'Baseline Elements', S.sectionTitle);
  merge(ws, 0, 0, 0, 11);

  const hRow = 4;
  const baselineHeaders = [
    'Plant', 'Volume', 'FTE',
    'Cost exc. depreciation (Total)', '%FC', '%VC',
    'RM & PM losses', 'CC exc. depr. & losses (Total)', '%FC CC', '%VC CC',
    'Result Plan', 'Validated CAPEX',
  ];
  baselineHeaders.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
  setRowHeight(ws, hRow, 25);

  // "All" row
  const aRow = 6;
  const totalVol = baselines.reduce((s, b) => s + n(b.volume), 0);
  const totalFTE = baselines.reduce((s, b) => s + n(b.totalFTE), 0);
  const allCostKeys: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];
  const fcKeys: CostElement[] = ['DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC'];
  const vcKeys: CostElement[] = ['RM', 'PM'];
  const lossKeys: CostElement[] = ['RM_Losses', 'PM_Losses'];

  const totalCost = getTotalBaselineCosts(baselines, allCostKeys);
  const totalFC = getTotalBaselineCosts(baselines, fcKeys);
  const totalVC = getTotalBaselineCosts(baselines, vcKeys);
  const totalLosses = getTotalBaselineCosts(baselines, lossKeys);
  const totalCC = getTotalConversionCost(baselines);
  const resultPlan = commitLevers.reduce((s, l) => s + n(l.netSavingsEUR), 0);
  const validatedCapex = commitLevers.reduce((s, l) => s + n(l.approvedCapexEUR), 0);

  const pctFC = totalCost > 0 ? totalFC / totalCost : 0;
  const pctVC = totalCost > 0 ? totalVC / totalCost : 0;

  setVal(ws, aRow, 0, 'All', S.total);
  setVal(ws, aRow, 1, totalVol, S.totalRight, fmt(0));
  setVal(ws, aRow, 2, totalFTE, S.totalRight, fmt(0));
  setVal(ws, aRow, 3, totalCost, S.totalRight, fmt(0));
  setVal(ws, aRow, 4, pctFC, S.totalRight, pct());
  setVal(ws, aRow, 5, pctVC, S.totalRight, pct());
  setVal(ws, aRow, 6, totalLosses, S.totalRight, fmt(0));
  setVal(ws, aRow, 7, totalCC, S.totalRight, fmt(0));
  setVal(ws, aRow, 8, totalCC > 0 ? totalFC / totalCC : 0, S.totalRight, pct());
  setVal(ws, aRow, 9, totalCC > 0 ? totalLosses / totalCC : 0, S.totalRight, pct());
  setVal(ws, aRow, 10, resultPlan, S.totalRight, fmt(0));
  setVal(ws, aRow, 11, validatedCapex, S.totalRight, fmt(0));

  // Section 2 — BBACM Committed Savings
  const s2Start = 8;
  setVal(ws, s2Start, 0, 'BBACM Committed Savings', S.sectionTitle);
  merge(ws, s2Start, 0, s2Start, 11 + years.length * 3);

  const s2hRow = s2Start + 4;
  const s2Headers = [
    'Plant', 'Total Savings', '% Savings', 'One-Off OPEX', 'Total CAPEX', 'Net CAPEX',
    ...years.flatMap(y => [`Savings ${y}`, `One-Off ${y}`, `CAPEX ${y}`]),
    'FTE Total', '% Prod.',
  ];
  s2Headers.forEach((h, ci) => setVal(ws, s2hRow, ci, h, S.headerDark));
  setRowHeight(ws, s2hRow, 25);

  const s2DataRow = s2hRow + 2;
  const totalSav = commitLevers.reduce((s, l) => s + n(l.netSavingsEUR), 0);
  const pctSav = totalCC > 0 ? totalSav / totalCC : 0;
  const totalOneOff = commitLevers.reduce((s, l) => s + n(l.oneOffOpexEUR), 0);
  const totalCapex = commitLevers.reduce((s, l) => s + n(l.capexEUR), 0);
  const netCapex = totalCapex - validatedCapex;
  const totalFTESav = commitLevers.reduce((s, l) => s + n(l.fte), 0);

  setVal(ws, s2DataRow, 0, 'All', S.total);
  setVal(ws, s2DataRow, 1, totalSav, S.totalRight, fmt(0));
  setVal(ws, s2DataRow, 2, pctSav, S.totalRight, pct());
  setVal(ws, s2DataRow, 3, totalOneOff, S.totalRight, fmt(0));
  setVal(ws, s2DataRow, 4, totalCapex, S.totalRight, fmt(0));
  setVal(ws, s2DataRow, 5, netCapex, S.totalRight, fmt(0));

  let ci = 6;
  for (const year of years) {
    const yStr = String(year);
    const ySav = commitLevers.reduce((s, l) => s + n(l.savingsByYear?.[yStr]), 0);
    const yOpex = commitLevers
      .filter(l => (l.kpiImpactYear || l.capexImpactYear) === yStr)
      .reduce((s, l) => s + n(l.oneOffOpexEUR), 0);
    const yCap = commitLevers
      .filter(l => l.capexImpactYear === yStr)
      .reduce((s, l) => s + n(l.capexEUR), 0);
    setVal(ws, s2DataRow, ci++, ySav, S.totalRight, fmt(0));
    setVal(ws, s2DataRow, ci++, yOpex, S.totalRight, fmt(0));
    setVal(ws, s2DataRow, ci++, yCap, S.totalRight, fmt(0));
  }
  setVal(ws, s2DataRow, ci++, totalFTESav, S.totalRight, fmt(0));
  setVal(ws, s2DataRow, ci, totalFTE > 0 ? totalFTESav / totalFTE : 0, S.totalRight, pct());

  // Section 3 — Full Potential
  const s3Start = s2Start + 10;
  setVal(ws, s3Start, 0, 'BBACM Full Potential Savings', S.sectionTitle);
  merge(ws, s3Start, 0, s3Start, 11 + years.length * 3);

  const s3hRow = s3Start + 4;
  s2Headers.forEach((h, ci2) => setVal(ws, s3hRow, ci2, h, S.headerDark));
  setRowHeight(ws, s3hRow, 25);

  const s3DataRow = s3hRow + 2;
  const fpSav = inScopeLevers.reduce((s, l) => s + n(l.netSavingsEUR), 0);
  const fpOneOff = inScopeLevers.reduce((s, l) => s + n(l.oneOffOpexEUR), 0);
  const fpCapex = inScopeLevers.reduce((s, l) => s + n(l.capexEUR), 0);
  const fpApproved = inScopeLevers.reduce((s, l) => s + n(l.approvedCapexEUR), 0);
  const fpNetCapex = fpCapex - fpApproved;
  const fpFTE = inScopeLevers.reduce((s, l) => s + n(l.fte), 0);

  setVal(ws, s3DataRow, 0, 'All', S.total);
  setVal(ws, s3DataRow, 1, fpSav, S.totalRight, fmt(0));
  setVal(ws, s3DataRow, 2, totalCC > 0 ? fpSav / totalCC : 0, S.totalRight, pct());
  setVal(ws, s3DataRow, 3, fpOneOff, S.totalRight, fmt(0));
  setVal(ws, s3DataRow, 4, fpCapex, S.totalRight, fmt(0));
  setVal(ws, s3DataRow, 5, fpNetCapex, S.totalRight, fmt(0));

  let ci3 = 6;
  for (const year of years) {
    const yStr = String(year);
    const ySav = inScopeLevers.reduce((s, l) => s + n(l.savingsByYear?.[yStr]), 0);
    const yOpex = inScopeLevers
      .filter(l => (l.kpiImpactYear || l.capexImpactYear) === yStr)
      .reduce((s, l) => s + n(l.oneOffOpexEUR), 0);
    const yCap = inScopeLevers
      .filter(l => l.capexImpactYear === yStr)
      .reduce((s, l) => s + n(l.capexEUR), 0);
    setVal(ws, s3DataRow, ci3++, ySav, S.totalRight, fmt(0));
    setVal(ws, s3DataRow, ci3++, yOpex, S.totalRight, fmt(0));
    setVal(ws, s3DataRow, ci3++, yCap, S.totalRight, fmt(0));
  }
  setVal(ws, s3DataRow, ci3++, fpFTE, S.totalRight, fmt(0));
  setVal(ws, s3DataRow, ci3, totalFTE > 0 ? fpFTE / totalFTE : 0, S.totalRight, pct());

  const lastCol = 6 + years.length * 3 + 1;
  setRange(ws, s3DataRow + 2, lastCol);

  const widths = [18, 14, 10, 14, 14, 14, ...years.flatMap(() => [14, 14, 14]), 12, 10];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 4: Baselines
// ---------------------------------------------------------------------------

function buildBaselinesSheet(plants: Plant[], baselines: Baseline[]): XLSX.WorkSheet {
  const ws = makeWs();
  const plantMap = new Map(plants.map(p => [p.id, p]));

  // Helper: get baseline for a plant
  const getBaseline = (plantId: string) => baselines.find(b => b.plantId === plantId);

  const allCostElements: CostElement[] = ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];
  const ceLabels: Record<CostElement, string> = {
    RM: 'RM', PM: 'PM', DLC: 'DLC', PILC: 'PILC', OVC: 'OVC',
    FC_Personal: 'FC - Personal', Maintenance: 'Maintenance', OFC: 'OFC',
    RM_Losses: 'RM Losses', PM_Losses: 'PM Losses',
  };

  // --- Table 1: Cost structure / Cost element ---
  setVal(ws, 0, 0, 'Cost structure / Cost element', S.sectionTitle);
  merge(ws, 0, 0, 0, 1 + plants.length);

  setVal(ws, 1, 0, '', S.empty);
  setVal(ws, 1, 1, 'Baseline (Total)', S.headerDark);
  plants.forEach((p, pi) => {
    setVal(ws, 1, 2 + pi, p.name, S.headerDark);
  });
  setRowHeight(ws, 1, 22);

  // Cost element rows
  allCostElements.forEach((ce, ei) => {
    const row = 2 + ei;
    setVal(ws, row, 0, ceLabels[ce], row % 2 === 0 ? S.rowEven : S.rowOdd);

    const totalVal = baselines.reduce((s, b) => s + n(b.costElements?.[ce]), 0);
    setVal(ws, row, 1, totalVal, S.rowEvenRight, fmt(0));

    plants.forEach((p, pi) => {
      const b = getBaseline(p.id);
      setVal(ws, row, 2 + pi, n(b?.costElements?.[ce]), row % 2 === 0 ? S.rowEvenRight : S.rowOddRight, fmt(0));
    });
  });

  // Total CC row
  const ccElements: CostElement[] = ['DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];
  const totalCCRow = 2 + allCostElements.length;
  setVal(ws, totalCCRow, 0, 'Total CC in k€', S.total);
  const totalCCAll = baselines.reduce((s, b) => s + ccElements.reduce((ss, ce) => ss + n(b.costElements?.[ce]), 0), 0);
  setVal(ws, totalCCRow, 1, totalCCAll, S.totalRight, fmt(0));
  plants.forEach((p, pi) => {
    const b = getBaseline(p.id);
    const cc = ccElements.reduce((s, ce) => s + n(b?.costElements?.[ce]), 0);
    setVal(ws, totalCCRow, 2 + pi, cc, S.totalRight, fmt(0));
  });

  // Total Costs row
  const totalCostsRow = totalCCRow + 1;
  setVal(ws, totalCostsRow, 0, 'Total Costs in k€', S.total);
  const totalAll = baselines.reduce((s, b) => s + allCostElements.reduce((ss, ce) => ss + n(b.costElements?.[ce]), 0), 0);
  setVal(ws, totalCostsRow, 1, totalAll, S.totalRight, fmt(0));
  plants.forEach((p, pi) => {
    const b = getBaseline(p.id);
    const total = allCostElements.reduce((s, ce) => s + n(b?.costElements?.[ce]), 0);
    setVal(ws, totalCostsRow, 2 + pi, total, S.totalRight, fmt(0));
  });

  // --- Table 2: Cost structure / Department ---
  const t2Start = totalCostsRow + 3;
  setVal(ws, t2Start, 0, 'Cost structure / Department', S.sectionTitle);
  merge(ws, t2Start, 0, t2Start, 1 + plants.length);

  setVal(ws, t2Start + 1, 0, '', S.empty);
  setVal(ws, t2Start + 1, 1, 'Total', S.headerDark);
  plants.forEach((p, pi) => setVal(ws, t2Start + 1, 2 + pi, p.name, S.headerDark));
  setRowHeight(ws, t2Start + 1, 22);

  const deptRows = [
    { label: 'RM', key: null as string | null },
    { label: 'PM', key: null },
    ...DEPARTMENTS_ORDERED.map(d => ({ label: d, key: d.replace(' ', '_') })),
  ];

  deptRows.forEach(({ label, key }, di) => {
    const row = t2Start + 2 + di;
    setVal(ws, row, 0, label, row % 2 === 0 ? S.rowEven : S.rowOdd);

    let totalVal = 0;
    if (label === 'RM') {
      totalVal = baselines.reduce((s, b) => s + n(b.costElements?.RM), 0);
    } else if (label === 'PM') {
      totalVal = baselines.reduce((s, b) => s + n(b.costElements?.PM), 0);
    } else if (key) {
      totalVal = baselines.reduce((s, b) => s + n((b.fteByDepartment as Record<string, number>)?.[key]), 0);
    }
    setVal(ws, row, 1, totalVal, row % 2 === 0 ? S.rowEvenRight : S.rowOddRight, fmt(0));

    plants.forEach((p, pi) => {
      const b = getBaseline(p.id);
      let val = 0;
      if (label === 'RM') val = n(b?.costElements?.RM);
      else if (label === 'PM') val = n(b?.costElements?.PM);
      else if (key) val = n((b?.fteByDepartment as Record<string, number> | undefined)?.[key]);
      setVal(ws, row, 2 + pi, val, row % 2 === 0 ? S.rowEvenRight : S.rowOddRight, fmt(0));
    });
  });

  const lastRow = t2Start + 2 + deptRows.length;
  const lastCol = 1 + plants.length;
  setRange(ws, lastRow, lastCol);

  const widths = [22, 16, ...plants.map(() => 14)];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Helper: build a phasing block (CS or DP)
// ---------------------------------------------------------------------------

function writePhasingBlock(
  ws: XLSX.WorkSheet,
  startRow: number,
  title: string,
  groups: string[],
  phasingData: Record<string, { baseline: number; capex: number; byYear: Record<string, number>; commitmentTotal: number; fullPotentialTotal: number; commitmentByYear?: Record<string, number> }>,
  years: number[],
  totalBaseline: number,
  isStructure: boolean,
): number {
  setVal(ws, startRow, 0, title, S.sectionTitle);
  merge(ws, startRow, 0, startRow, 3 + years.length * 2 + 4);

  const hRow = startRow + 4;
  const yearHeaders: string[] = [];
  years.forEach(y => { yearHeaders.push(`Savings ${y}`); yearHeaders.push(''); });

  const headers = [
    'Nature of costs',
    `Baseline`,
    'CAPEX',
    ...yearHeaders,
    'Commitment Total',
    '% Commit',
    'Full Potential',
    '% Full Pot.',
  ];
  headers.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
  setRowHeight(ws, hRow, 25);

  let dataRow = hRow + 1;
  let totBaseline = 0, totCapex = 0, totCommit = 0, totFull = 0;
  const totByYear: Record<string, number> = {};
  years.forEach(y => { totByYear[String(y)] = 0; });

  for (const group of groups) {
    const row_data = phasingData[group] || { baseline: 0, capex: 0, byYear: {}, commitmentTotal: 0, fullPotentialTotal: 0 };
    const st = S.rowEven;
    const stR = S.rowEvenRight;

    setVal(ws, dataRow, 0, isStructure ? (STRUCTURE_DISPLAY[group] || group) : group, st);
    setVal(ws, dataRow, 1, n(row_data.baseline), stR, fmt(0));
    setVal(ws, dataRow, 2, n(row_data.capex), S.capexRow, fmt(0));

    let ci = 3;
    for (const year of years) {
      const yStr = String(year);
      const commitVal = row_data.commitmentByYear?.[yStr] || 0;
      const fullVal = row_data.byYear[yStr] || 0;
      setVal(ws, dataRow, ci++, commitVal, S.commitment, fmt(0));
      setVal(ws, dataRow, ci++, fullVal > commitVal ? fullVal - commitVal : 0, S.additional, fmt(0));
      totByYear[yStr] = (totByYear[yStr] || 0) + fullVal;
    }

    setVal(ws, dataRow, ci++, n(row_data.commitmentTotal), S.commitment, fmt(0));
    setVal(ws, dataRow, ci++, row_data.baseline > 0 ? row_data.commitmentTotal / row_data.baseline : 0, S.percent, pct());
    setVal(ws, dataRow, ci++, n(row_data.fullPotentialTotal), stR, fmt(0));
    setVal(ws, dataRow, ci, row_data.baseline > 0 ? row_data.fullPotentialTotal / row_data.baseline : 0, S.percent, pct());

    totBaseline += n(row_data.baseline);
    totCapex += n(row_data.capex);
    totCommit += n(row_data.commitmentTotal);
    totFull += n(row_data.fullPotentialTotal);
    dataRow++;
  }

  // Total row
  setVal(ws, dataRow, 0, 'Total', S.total);
  setVal(ws, dataRow, 1, totBaseline, S.totalRight, fmt(0));
  setVal(ws, dataRow, 2, totCapex, S.totalRight, fmt(0));
  let tci = 3;
  years.forEach(y => {
    setVal(ws, dataRow, tci++, totByYear[String(y)] || 0, S.totalRight, fmt(0));
    setVal(ws, dataRow, tci++, 0, S.total);
  });
  setVal(ws, dataRow, tci++, totCommit, S.totalRight, fmt(0));
  setVal(ws, dataRow, tci++, totBaseline > 0 ? totCommit / totBaseline : 0, S.totalRight, pct());
  setVal(ws, dataRow, tci++, totFull, S.totalRight, fmt(0));
  setVal(ws, dataRow, tci, totBaseline > 0 ? totFull / totBaseline : 0, S.totalRight, pct());
  dataRow++;

  // "% of Baseline" row
  setVal(ws, dataRow, 0, '% of Baseline', S.label);
  let pci = 3;
  years.forEach(y => {
    const yVal = totByYear[String(y)] || 0;
    setVal(ws, dataRow, pci++, totalBaseline > 0 ? yVal / totalBaseline : 0, S.percent, pct());
    setVal(ws, dataRow, pci++, null, S.empty);
  });

  return dataRow + 1;
}

// ---------------------------------------------------------------------------
// Sheet 5: Phasing Savings CS
// ---------------------------------------------------------------------------

function buildPhasingCSSheet(
  levers: Lever[],
  baselines: Baseline[],
  years: number[],
): XLSX.WorkSheet {
  const ws = makeWs();

  const annual = calcAnnualPhasing(levers, years, 'structure', baselines);
  const cumulated = calcCumulatedPhasing(annual, years);
  const totalBaseline = getTotalBaselineCosts(baselines);

  const nextRow = writePhasingBlock(ws, 0, 'Savings per year - Cost Structure', IMPROVEMENT_STRUCTURES_ORDERED, annual, years, totalBaseline, true);
  const bloc2Start = Math.max(nextRow + 2, 18);
  writePhasingBlock(ws, bloc2Start, 'Cumulated savings per year - Cost Structure', IMPROVEMENT_STRUCTURES_ORDERED, cumulated, years, totalBaseline, true);

  const lastCol = 3 + years.length * 2 + 3;
  setRange(ws, bloc2Start + 18, lastCol);

  const widths = [22, 16, 14, ...years.flatMap(() => [14, 14]), 14, 10, 14, 10];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 6: Phasing Savings DP
// ---------------------------------------------------------------------------

function buildPhasingDPSheet(
  levers: Lever[],
  baselines: Baseline[],
  years: number[],
): XLSX.WorkSheet {
  const ws = makeWs();

  const annual = calcAnnualPhasing(levers, years, 'department', baselines);
  const cumulated = calcCumulatedPhasing(annual, years);
  const totalBaseline = getTotalBaselineCosts(baselines);

  const nextRow = writePhasingBlock(ws, 0, 'Savings per year - Department', DEPARTMENTS_ORDERED, annual, years, totalBaseline, false);
  const bloc2Start = Math.max(nextRow + 2, 18);
  writePhasingBlock(ws, bloc2Start, 'Cumulated savings per year - Department', DEPARTMENTS_ORDERED, cumulated, years, totalBaseline, false);

  const lastCol = 3 + years.length * 2 + 3;
  setRange(ws, bloc2Start + 18, lastCol);

  const widths = [22, 16, 14, ...years.flatMap(() => [14, 14]), 14, 10, 14, 10];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 7: Phasing Organization (FTE)
// ---------------------------------------------------------------------------

function buildPhasingOrganizationSheet(
  levers: Lever[],
  baselines: Baseline[],
  years: number[],
): XLSX.WorkSheet {
  const ws = makeWs();

  const annual = calcFTEPhasing(levers, baselines, years);
  const cumulated: typeof annual = {};

  // Build cumulated FTE
  for (const dept of DEPARTMENTS_ORDERED) {
    const row_data = annual[dept];
    const byYear: Record<string, number> = {};
    let runSum = 0;
    for (const year of years) {
      const yStr = String(year);
      runSum += row_data.byYear[yStr] || 0;
      byYear[yStr] = runSum;
    }
    cumulated[dept] = { ...row_data, byYear };
  }

  const writeOrgBlock = (startRow: number, title: string, data: typeof annual): number => {
    setVal(ws, startRow, 0, title, S.sectionTitle);
    merge(ws, startRow, 0, startRow, 3 + years.length + 3);

    const hRow = startRow + 4;
    const headers = [
      'Department', 'Baseline FTE',
      ...years.map(y => `FTE ${y}`),
      'Commitment Total', '% Commit', 'Full Potential', '% Full Pot.',
    ];
    headers.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
    setRowHeight(ws, hRow, 25);

    let dataRow = hRow + 1;
    let totBase = 0, totCommit = 0, totFull = 0;
    const totByYear: Record<string, number> = {};
    years.forEach(y => { totByYear[String(y)] = 0; });

    for (const dept of DEPARTMENTS_ORDERED) {
      const row_data = data[dept] || { baseline: 0, byYear: {}, commitmentTotal: 0, fullPotentialTotal: 0 };
      const st = S.rowEven;
      const stR = S.rowEvenRight;

      setVal(ws, dataRow, 0, dept, st);
      setVal(ws, dataRow, 1, n(row_data.baseline), stR, fmt(0));

      let ci = 2;
      for (const year of years) {
        const yStr = String(year);
        const val = row_data.byYear[yStr] || 0;
        setVal(ws, dataRow, ci++, val, stR, fmt(0));
        totByYear[yStr] = (totByYear[yStr] || 0) + val;
      }

      setVal(ws, dataRow, ci++, n(row_data.commitmentTotal), S.commitment, fmt(0));
      setVal(ws, dataRow, ci++, row_data.baseline > 0 ? row_data.commitmentTotal / row_data.baseline : 0, S.percent, pct());
      setVal(ws, dataRow, ci++, n(row_data.fullPotentialTotal), stR, fmt(0));
      setVal(ws, dataRow, ci, row_data.baseline > 0 ? row_data.fullPotentialTotal / row_data.baseline : 0, S.percent, pct());

      totBase += n(row_data.baseline);
      totCommit += n(row_data.commitmentTotal);
      totFull += n(row_data.fullPotentialTotal);
      dataRow++;
    }

    // Total row
    setVal(ws, dataRow, 0, 'Total', S.total);
    setVal(ws, dataRow, 1, totBase, S.totalRight, fmt(0));
    let tci = 2;
    years.forEach(y => setVal(ws, dataRow, tci++, totByYear[String(y)] || 0, S.totalRight, fmt(0)));
    setVal(ws, dataRow, tci++, totCommit, S.totalRight, fmt(0));
    setVal(ws, dataRow, tci++, totBase > 0 ? totCommit / totBase : 0, S.totalRight, pct());
    setVal(ws, dataRow, tci++, totFull, S.totalRight, fmt(0));
    setVal(ws, dataRow, tci, totBase > 0 ? totFull / totBase : 0, S.totalRight, pct());

    return dataRow + 1;
  };

  const nextRow = writeOrgBlock(0, 'FTE Savings per year', annual);
  const bloc2Start = Math.max(nextRow + 2, 18);
  writeOrgBlock(bloc2Start, 'Cumulated FTE Savings per year', cumulated);

  const lastCol = 2 + years.length + 3;
  setRange(ws, bloc2Start + 18, lastCol);

  const widths = [22, 14, ...years.map(() => 12), 14, 10, 14, 10];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 8: Phasing CAPEX & OPEX
// ---------------------------------------------------------------------------

function buildPhasingCapexSheet(levers: Lever[], years: number[]): XLSX.WorkSheet {
  const ws = makeWs();

  const annual = calcCapexPhasing(levers, years);
  const cumulated = calcCumulatedCapexPhasing(annual, years);

  const writeCapexBlock = (
    startRow: number,
    title: string,
    data: typeof annual,
    includeApproved: boolean,
  ): number => {
    setVal(ws, startRow, 0, title, S.sectionTitle);
    merge(ws, startRow, 0, startRow, 1 + years.length);

    const hRow = startRow + 4;
    const headers = ['', ...years.map(y => String(y)), 'Total Commitment'];
    headers.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
    setRowHeight(ws, hRow, 22);

    let row = hRow + 2;

    // CAPEX row
    setVal(ws, row, 0, 'CAPEX', S.capexRow);
    years.forEach((y, yi) => setVal(ws, row, 1 + yi, n(data.byYear[String(y)]?.capex), S.capexRow, fmt(0)));
    setVal(ws, row, 1 + years.length, n(data.commitmentTotal.capex), S.capexRow, fmt(0));
    row++;

    if (includeApproved) {
      // Approved CAPEX
      setVal(ws, row, 0, 'Approved CAPEX', S.approvedCapexRow);
      years.forEach((y, yi) => setVal(ws, row, 1 + yi, n(data.byYear[String(y)]?.approvedCapex), S.approvedCapexRow, fmt(0)));
      setVal(ws, row, 1 + years.length, n(data.commitmentTotal.approvedCapex), S.approvedCapexRow, fmt(0));
      row++;

      // Required CAPEX
      setVal(ws, row, 0, 'Required CAPEX', S.capexRow);
      years.forEach((y, yi) => {
        const cap = n(data.byYear[String(y)]?.capex);
        const app = n(data.byYear[String(y)]?.approvedCapex);
        setVal(ws, row, 1 + yi, cap - app, S.capexRow, fmt(0));
      });
      const reqTotal = n(data.commitmentTotal.capex) - n(data.commitmentTotal.approvedCapex);
      setVal(ws, row, 1 + years.length, reqTotal, S.capexRow, fmt(0));
      row++;
    }

    return row + 1;
  };

  const writeOpexBlock = (startRow: number, title: string, data: typeof annual): number => {
    setVal(ws, startRow, 0, title, S.sectionTitle);
    merge(ws, startRow, 0, startRow, 1 + years.length);

    const hRow = startRow + 4;
    const headers = ['', ...years.map(y => String(y)), 'Total Commitment'];
    headers.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
    setRowHeight(ws, hRow, 22);

    const row = hRow + 2;
    setVal(ws, row, 0, 'One-Off OPEX', S.additional);
    years.forEach((y, yi) => setVal(ws, row, 1 + yi, n(data.byYear[String(y)]?.oneOffOpex), S.additional, fmt(0)));
    setVal(ws, row, 1 + years.length, n(data.commitmentTotal.oneOffOpex), S.additional, fmt(0));

    return row + 2;
  };

  // Bloc 1 — CAPEX per year
  const n1 = writeCapexBlock(0, 'CAPEX per year', annual, true);
  // Bloc 2 — Cumulated CAPEX
  const bloc2Start = Math.max(n1 + 1, 10);
  const n2 = writeCapexBlock(bloc2Start, 'Cumulated CAPEX per year', cumulated, true);
  // Bloc 3 — One-Off OPEX
  const bloc3Start = Math.max(n2 + 1, 20);
  const n3 = writeOpexBlock(bloc3Start, 'One-Off OPEX per year', annual);
  // Bloc 4 — Cumulated One-Off OPEX
  const bloc4Start = Math.max(n3 + 1, 28);
  writeOpexBlock(bloc4Start, 'Cumulated One-Off OPEX per year', cumulated);

  const lastCol = 1 + years.length;
  setRange(ws, bloc4Start + 8, lastCol);

  const widths = [22, ...years.map(() => 14), 16];
  setCols(ws, widths);

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 9: Out of Scope
// ---------------------------------------------------------------------------

function buildOutOfScopeSheet(levers: Lever[]): XLSX.WorkSheet {
  const ws = makeWs();

  const WC_WOW = ['Working Capital', 'WoW'];
  const OTHERS = ['RM Formulation', 'PM Formulation', 'Other OOS', 'Additional Margin', 'Working Capital', 'WoW'];

  const getAgg = (filters: string[]) => {
    const filtered = levers.filter(l => filters.includes(l.improvementStructure as string));
    const byGroup: Record<string, { commitNet: number; commitCap: number; addNet: number; addCap: number }> = {};
    for (const f of filters) {
      byGroup[f] = { commitNet: 0, commitCap: 0, addNet: 0, addCap: 0 };
    }
    for (const lever of filtered) {
      const g = lever.improvementStructure as string;
      if (!byGroup[g]) byGroup[g] = { commitNet: 0, commitCap: 0, addNet: 0, addCap: 0 };
      if (lever.commitment === 'Commitment') {
        byGroup[g].commitNet += n(lever.netSavingsEUR);
        byGroup[g].commitCap += n(lever.capexEUR);
      } else if (lever.commitment === 'Additional Potential') {
        byGroup[g].addNet += n(lever.netSavingsEUR);
        byGroup[g].addCap += n(lever.capexEUR);
      }
    }
    return byGroup;
  };

  const writeOosBlock = (
    startRow: number,
    title: string,
    groups: string[],
    agg: Record<string, { commitNet: number; commitCap: number; addNet: number; addCap: number }>,
  ): number => {
    setVal(ws, startRow, 0, title, S.sectionTitle);
    merge(ws, startRow, 0, startRow, 8);

    const hRow = startRow + 4;
    const headers = [
      '',
      'Commitment Net Savings', 'Commitment CAPEX',
      'Add. Potential Net Savings', 'Add. Potential CAPEX',
      'Full Potential Net Savings', 'Full Potential CAPEX',
    ];
    headers.forEach((h, ci) => setVal(ws, hRow, ci, h, S.headerDark));
    setRowHeight(ws, hRow, 25);

    let dataRow = hRow + 2;
    let totCN = 0, totCC = 0, totAN = 0, totAC = 0;

    for (const group of groups) {
      const a = agg[group] || { commitNet: 0, commitCap: 0, addNet: 0, addCap: 0 };
      setVal(ws, dataRow, 0, group, S.rowEven);
      setVal(ws, dataRow, 1, a.commitNet, S.commitment, fmt(0));
      setVal(ws, dataRow, 2, a.commitCap, S.commitment, fmt(0));
      setVal(ws, dataRow, 3, a.addNet, S.additional, fmt(0));
      setVal(ws, dataRow, 4, a.addCap, S.additional, fmt(0));
      setVal(ws, dataRow, 5, a.commitNet + a.addNet, S.rowEvenRight, fmt(0));
      setVal(ws, dataRow, 6, a.commitCap + a.addCap, S.rowEvenRight, fmt(0));
      totCN += a.commitNet; totCC += a.commitCap;
      totAN += a.addNet; totAC += a.addCap;
      dataRow++;
    }

    // Total row
    setVal(ws, dataRow, 0, 'Total', S.total);
    setVal(ws, dataRow, 1, totCN, S.totalRight, fmt(0));
    setVal(ws, dataRow, 2, totCC, S.totalRight, fmt(0));
    setVal(ws, dataRow, 3, totAN, S.totalRight, fmt(0));
    setVal(ws, dataRow, 4, totAC, S.totalRight, fmt(0));
    setVal(ws, dataRow, 5, totCN + totAN, S.totalRight, fmt(0));
    setVal(ws, dataRow, 6, totCC + totAC, S.totalRight, fmt(0));

    return dataRow + 2;
  };

  const agg1 = getAgg(WC_WOW);
  const nextRow = writeOosBlock(0, 'Out of Scope - Working Capital & WoW', WC_WOW, agg1);

  const agg2 = getAgg(OTHERS);
  writeOosBlock(Math.max(nextRow + 1, 10), 'Out of Scope - Others', OTHERS, agg2);

  setRange(ws, 35, 8);
  setCols(ws, [24, 18, 16, 18, 16, 18, 16]);

  return ws;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export interface ExportConfig {
  project: Project;
  plants: Plant[];
  levers: Lever[];
  baselines: Baseline[];
  years: number[];
  filename?: string;
}

export function exportProjectToExcel(config: ExportConfig): void {
  const { project, plants, levers, baselines, years } = config;
  const filename = (config.filename || `${project.name}_ProjectPlanner`)
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    .trim() + '.xlsx';

  const wb = XLSX.utils.book_new();

  // Build all 9 sheets
  const sheet1 = buildPerformanceLeversSheet(project, plants, levers, years);
  XLSX.utils.book_append_sheet(wb, sheet1, 'Performance Levers');

  const sheet2 = buildExecutiveSummarySheet(levers);
  XLSX.utils.book_append_sheet(wb, sheet2, 'Executive Summary');

  const sheet3 = buildSynthesisSheet(project, plants, levers, baselines, years);
  XLSX.utils.book_append_sheet(wb, sheet3, 'Synthesis');

  const sheet4 = buildBaselinesSheet(plants, baselines);
  XLSX.utils.book_append_sheet(wb, sheet4, 'Baselines');

  const sheet5 = buildPhasingCSSheet(levers, baselines, years);
  XLSX.utils.book_append_sheet(wb, sheet5, 'Phasing Savings CS');

  const sheet6 = buildPhasingDPSheet(levers, baselines, years);
  XLSX.utils.book_append_sheet(wb, sheet6, 'Phasing Savings DP');

  const sheet7 = buildPhasingOrganizationSheet(levers, baselines, years);
  XLSX.utils.book_append_sheet(wb, sheet7, 'Phasing Organization');

  const sheet8 = buildPhasingCapexSheet(levers, years);
  XLSX.utils.book_append_sheet(wb, sheet8, 'Phasing CAPEX & OPEX');

  const sheet9 = buildOutOfScopeSheet(levers);
  XLSX.utils.book_append_sheet(wb, sheet9, 'Out of Scope');

  // Write and trigger download
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
}
