import * as XLSX from 'xlsx';
import type { Baseline, CostElement, Department } from '../types/baseline';
import type { Lever } from '../types/lever';

const COST_ELEMENT_MAP: Record<string, CostElement> = {
  'RM': 'RM', 'Raw Materials': 'RM',
  'PM': 'PM', 'Packaging Materials': 'PM',
  'DLC': 'DLC', 'Direct Labour Cost': 'DLC',
  'PILC': 'PILC', 'Planned Indirect Labour Cost': 'PILC',
  'OVC': 'OVC', 'Other Variable Costs': 'OVC',
  'FC - Personal': 'FC_Personal', 'FC-Personal': 'FC_Personal', 'FC_Personal': 'FC_Personal', 'Fixed Costs – Personnel': 'FC_Personal',
  'Maintenance': 'Maintenance',
  'OFC': 'OFC', 'Other Fixed Costs': 'OFC',
  'RM Losses': 'RM_Losses', 'RM_Losses': 'RM_Losses',
  'PM Losses': 'PM_Losses', 'PM_Losses': 'PM_Losses',
};

const DEPT_MAP: Record<string, Department> = {
  'Manufacturing': 'Manufacturing',
  'Supply Chain': 'Supply_Chain', 'Supply_Chain': 'Supply_Chain',
  'Maintenance': 'Maintenance',
  'Purchasing': 'Purchasing',
  'Quality': 'Quality',
  'GM': 'GM', 'General Management': 'GM',
  'HR': 'HR', 'Human Resources': 'HR',
  'IT': 'IT',
  'Finance': 'Finance',
  'HSE': 'HSE',
  'Engineering': 'Engineering',
};

export function parseBaselineExcel(
  file: File,
  projectId: string,
  plantMap: Record<string, string> // plantName -> plantId
): Promise<Partial<Baseline>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerRow = rows[0] as string[];
        const baselines: Partial<Baseline>[] = [];

        // Col 0: cost element name, Col 1: group baseline, Col 2+: plants
        const plantColumns: { idx: number; plantId: string }[] = [];
        for (let i = 2; i < headerRow.length; i++) {
          const plantName = String(headerRow[i] || '').trim();
          if (plantName && plantMap[plantName]) {
            plantColumns.push({ idx: i, plantId: plantMap[plantName] });
          }
        }

        const costElementsMap: Record<string, Record<CostElement, number>> = {};
        plantColumns.forEach(p => {
          costElementsMap[p.plantId] = {} as Record<CostElement, number>;
        });

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] as (string | number)[];
          const label = String(row[0] || '').trim();
          const costEl = COST_ELEMENT_MAP[label];
          if (!costEl) continue;

          plantColumns.forEach(p => {
            const val = Number(row[p.idx]) || 0;
            costElementsMap[p.plantId][costEl] = val;
          });
        }

        plantColumns.forEach(p => {
          baselines.push({
            projectId,
            plantId: p.plantId,
            year: new Date().getFullYear() - 1,
            costElements: costElementsMap[p.plantId],
            fteByDepartment: {} as Record<Department, number>,
            volume: 0,
            totalFTE: 0,
          });
        });

        resolve(baselines);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function parseLeversExcel(
  file: File,
  projectId: string,
  plantMap: Record<string, string>,
  years: number[]
): Promise<Partial<Lever>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

        const levers: Partial<Lever>[] = rows.map((row) => {
          const savingsByYear: Record<string, number> = {};
          years.forEach(y => {
            const key = Object.keys(row).find(k => k.includes('Savings') && k.includes(String(y)));
            if (key) savingsByYear[String(y)] = Number(row[key]) || 0;
          });

          const plantName = String(row['Plant'] || '').trim();

          return {
            projectId,
            plantId: plantMap[plantName] || '',
            leverId: String(row['ID'] || ''),
            platform: String(row['Platform'] || ''),
            department: String(row['Department'] || ''),
            title: String(row['Performance Lever'] || ''),
            source: String(row['Source'] || '') as Lever['source'],
            improvementStructure: String(row['Improvement Structure'] || '') as Lever['improvementStructure'],
            leverType: String(row['Lever Type'] || '') as Lever['leverType'],
            digitalizationMechanization: String(row['Digitalization / Mechanization'] || '') as Lever['digitalizationMechanization'],
            inBudget: String(row['In Budget'] || '').toLowerCase() === 'yes',
            inScope: String(row['In Scope'] || '').toLowerCase() === 'yes',
            commitment: String(row['Commitment/Additional Potential/No Go'] || 'No Go') as Lever['commitment'],
            savingsByYear,
            fyTotalSavingsLC: Number(row['FY Cost Savings (LC)']) || 0,
            capexLC: Number(row['CAPEX (LC)']) || 0,
            approvedCapexLC: Number(row['Approved CAPEX (LC)']) || 0,
            oneOffOpexLC: Number(row['One-Off OPEX (LC)']) || 0,
            recurringOpexLC: Number(row['Recurring OPEX (LC)']) || 0,
            netSavingsLC: Number(row['Net Savings (LC)']) || 0,
            fyTotalSavingsEUR: Number(row['FY Cost Savings (€)']) || 0,
            capexEUR: Number(row['CAPEX (€)']) || 0,
            approvedCapexEUR: Number(row['Approved CAPEX (€)']) || 0,
            oneOffOpexEUR: Number(row['One-Off OPEX (€)']) || 0,
            recurringOpexEUR: Number(row['Recurring OPEX (€)']) || 0,
            netSavingsEUR: Number(row['Net Savings (€)']) || 0,
            payback: Number(row['Payback']) || 0,
            benefits: Number(row['Benefits']) || 0,
            feasibility: Number(row['Feasibility']) || 0,
            comment: String(row['Comment'] || ''),
            fteSavingsType: String(row['FTE Savings Type'] || 'Not impacting') as Lever['fteSavingsType'],
            fte: Number(row['FTE']) || 0,
            implementationStart: String(row['Project Implementation Starting Date'] || ''),
            implementationEnd: String(row['Project Implementation Ending Date'] || ''),
            gy: [0, 0, 0],
            oee: [0, 0, 0],
            ht: [0, 0, 0],
            rmLosses: 0,
            pmLosses: 0,
            projectDurationMonths: 0,
            capexImpactYear: '',
            kpiImpactYear: '',
            oeeOrFte: '',
          };
        });

        resolve(levers);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
