import * as XLSX from 'xlsx';
import type { Lever } from '../types/lever';
import type { Baseline, CostElement } from '../types/baseline';
import { COST_ELEMENT_LABELS } from '../types/baseline';

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
