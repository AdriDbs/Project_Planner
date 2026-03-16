import * as XLSX from 'xlsx';
import type { Baseline, CostElement, Department } from '../types/baseline';
import type {
  BaselineMatrix,
  BaselineMatrixRow,
  BaselineVolumes,
  BaselineVolumeRow,
} from '../types/baseline';
import { recomputeCalculatedRows } from '../types/baseline';
import type { Lever } from '../types/lever';

// ---------------------------------------------------------------------------
// Legacy maps — kept for old importers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Legacy: parseBaselineExcel (backward-compat, old per-plant format)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// New v2 parsers
// ---------------------------------------------------------------------------

/**
 * Detect baseline type from an Excel file.
 * Returns 'cost_element', 'department_or_fte', or 'volumes'.
 */
export function detectBaselineType(
  file: File,
): Promise<'cost_element' | 'department_or_fte' | 'volumes'> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Find first non-empty row
        for (const row of rows) {
          if (!row || row.length === 0) continue;
          const firstCell = String(row[0] || '').trim().toLowerCase();
          if (!firstCell) continue;

          if (firstCell.includes('platform') || firstCell.includes('plant')) {
            // Check second cell too
            const secondCell = String(row[1] || '').trim().toLowerCase();
            if (secondCell.includes('plant') || secondCell.includes('platform') || secondCell.includes('volume')) {
              resolve('volumes');
              return;
            }
          }
          if (firstCell.includes('cost element') || firstCell.includes('cost structure')) {
            // Check if it contains "element" specifically
            if (firstCell.includes('element')) {
              resolve('cost_element');
              return;
            }
            if (firstCell.includes('department') || firstCell.includes('dept')) {
              resolve('department_or_fte');
              return;
            }
          }
          break;
        }

        // Check second row if first was empty
        const allRows = rows.filter(r => r && r.some(c => c !== null && c !== ''));
        for (const row of allRows.slice(0, 3)) {
          const cells = row.map(c => String(c || '').trim().toLowerCase());
          if (cells.some(c => c.includes('volume'))) {
            resolve('volumes');
            return;
          }
          if (cells.some(c => c.includes('cost element'))) {
            resolve('cost_element');
            return;
          }
          if (cells.some(c => c.includes('department') || c.includes('dept'))) {
            resolve('department_or_fte');
            return;
          }
        }

        // Default fallback: assume cost_element
        resolve('cost_element');
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

/**
 * Map from Excel label → internal row label (display label used in BaselineMatrixRow)
 */
const LABEL_MAP_COST_ELEMENT: Record<string, string> = {
  'RM': 'RM', 'Raw Materials': 'RM',
  'PM': 'PM', 'Packaging Materials': 'PM',
  'DLC': 'DLC', 'Direct Labour Cost': 'DLC',
  'PILC': 'PILC', 'Planned Indirect Labour Cost': 'PILC',
  'OVC': 'OVC', 'Other Variable Costs': 'OVC',
  'FC - Personal': 'FC - Personal', 'FC-Personal': 'FC - Personal',
  'FC_Personal': 'FC - Personal', 'Fixed Costs – Personnel': 'FC - Personal',
  'Maintenance': 'Maintenance',
  'OFC': 'OFC', 'Other Fixed Costs': 'OFC',
  'RM Losses': 'RM Losses', 'RM_Losses': 'RM Losses',
  'PM Losses': 'PM Losses', 'PM_Losses': 'PM Losses',
};

const LABEL_MAP_DEPARTMENT: Record<string, string> = {
  'RM': 'RM', 'Raw Materials': 'RM',
  'PM': 'PM', 'Packaging Materials': 'PM',
  'Manufacturing': 'Manufacturing',
  'Supply Chain': 'Supply Chain', 'Supply_Chain': 'Supply Chain',
  'Maintenance': 'Maintenance',
  'Purchasing': 'Purchasing',
  'Quality': 'Quality',
  'GM': 'GM', 'General Management': 'GM',
  'HR': 'HR', 'Human Resources': 'HR',
  'IT': 'IT',
  'Finance': 'Finance',
  'HSE': 'HSE',
  'Engineering': 'Engineering',
  'RM Losses': 'RM Losses', 'RM_Losses': 'RM Losses',
  'PM Losses': 'PM Losses', 'PM_Losses': 'PM Losses',
};

/**
 * Parse a matrix baseline Excel file (cost_element | department | fte_department).
 *
 * Expected format for cost_element:
 *   Row 0: "Cost structure / Cost element" | "Baseline" | [Plant1] | [Plant2] | ...
 *   Row 1: (empty) | "Actual 2018" | ...
 *   Row 2+: cost element rows
 *
 * Expected format for department / fte_department:
 *   Row 0: (empty or separator)
 *   Row 1: "Cost structure / Department" | "Baseline" | [Plant1] | ...
 *   Row 2: (empty) | "Actual 2018" | ...
 *   Row 3+: department rows
 */
export function parseBaselineMatrixExcel(
  file: File,
  projectId: string,
  type: 'cost_element' | 'department' | 'fte_department',
  projectPlants: string[], // plant names from the project
): Promise<BaselineMatrix> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        const labelMap = type === 'cost_element' ? LABEL_MAP_COST_ELEMENT : LABEL_MAP_DEPARTMENT;

        // Find the header row (contains "Baseline" or plant names)
        let headerRowIdx = 0;
        for (let ri = 0; ri < Math.min(5, rawRows.length); ri++) {
          const row = rawRows[ri];
          if (!row) continue;
          const cells = row.map(c => String(c || '').trim());
          // Header row has "Baseline" in col 1, or plants in col 2+
          if (cells[1]?.toLowerCase() === 'baseline' || cells.slice(2).some(c => c.length > 0)) {
            headerRowIdx = ri;
            break;
          }
        }

        const headerRow = rawRows[headerRowIdx] ?? [];
        const headerCells = headerRow.map(c => String(c || '').trim());

        // Extract reference label from the next row, col 1
        let referenceLabel = '';
        const nextRow = rawRows[headerRowIdx + 1];
        if (nextRow) {
          referenceLabel = String(nextRow[1] || '').trim();
        }

        // Extract plant columns (col 2+)
        const plantColumns: { idx: number; name: string }[] = [];
        for (let ci = 2; ci < headerCells.length; ci++) {
          const name = headerCells[ci];
          if (name && name.toLowerCase() !== 'baseline') {
            plantColumns.push({ idx: ci, name });
          }
        }

        // Use project plants if no columns found, or match/filter
        const activePlants = plantColumns.length > 0
          ? plantColumns.map(p => p.name)
          : projectPlants;

        // Parse data rows (starting after header + referenceLabel rows)
        const dataStartRow = headerRowIdx + 2;
        const rowMap = new Map<string, Record<string, number>>();

        for (let ri = dataStartRow; ri < rawRows.length; ri++) {
          const row = rawRows[ri];
          if (!row) continue;
          const rawLabel = String(row[0] || '').trim();
          if (!rawLabel) continue;

          const mappedLabel = labelMap[rawLabel];
          if (!mappedLabel) continue; // skip unknown / total rows

          const values: Record<string, number> = {};
          if (plantColumns.length > 0) {
            plantColumns.forEach(p => {
              values[p.name] = Number(row[p.idx]) || 0;
            });
          } else {
            // No plant columns found, try col 1 as single value
            projectPlants.forEach(p => {
              values[p] = 0;
            });
          }
          rowMap.set(mappedLabel, values);
        }

        // Build rows array
        const expectedLabels = type === 'cost_element'
          ? ['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC - Personal', 'Maintenance', 'OFC', 'RM Losses', 'PM Losses']
          : ['RM', 'PM', 'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality', 'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering', 'RM Losses', 'PM Losses'];

        const dataRows: BaselineMatrixRow[] = expectedLabels.map(label => {
          const values = rowMap.get(label) ?? Object.fromEntries(activePlants.map(p => [p, 0]));
          const total = Object.values(values).reduce((s, v) => s + v, 0);
          return { label, isCalculated: false, values, total };
        });

        // Add calculated rows
        const allRows = recomputeCalculatedRows(dataRows, type, activePlants);

        resolve({
          id: `${projectId}_${type}`,
          projectId,
          type,
          referenceLabel,
          rows: allRows,
          plants: activePlants,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

/**
 * Parse a volumes baseline Excel file.
 *
 * Expected format:
 *   Row 0: "Platform" | "Plant" | "Volume A2018" (or similar)
 *   Row 1+: data rows
 *   Last row (optional): total row (ignored if Plant === 'Total')
 */
export function parseBaselineVolumesExcel(
  file: File,
  projectId: string,
): Promise<BaselineVolumes> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        if (rawRows.length === 0) throw new Error('Fichier vide');

        const headerRow = rawRows[0] ?? [];
        const referenceLabel = String(headerRow[2] || 'Volume').trim();

        const rows: BaselineVolumeRow[] = [];
        for (let ri = 1; ri < rawRows.length; ri++) {
          const row = rawRows[ri];
          if (!row) continue;
          const platform = String(row[0] || '').trim();
          const plant = String(row[1] || '').trim();
          const volume = Number(row[2]) || 0;

          if (!plant || plant.toLowerCase() === 'total') continue;

          rows.push({ platform, plant, volume });
        }

        resolve({
          id: `${projectId}_volumes`,
          projectId,
          type: 'volumes',
          referenceLabel,
          rows,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ---------------------------------------------------------------------------
// Legacy: parseLeversExcel (unchanged)
// ---------------------------------------------------------------------------

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

          // Support both 'Plant' (name) and 'Plant ID' (id) column headers.
          // Try name lookup first; fall back to using the raw value as a plant ID.
          const plantNameOrId = String(row['Plant'] || row['Plant ID'] || '').trim();
          const resolvedPlantId = plantMap[plantNameOrId] || plantNameOrId;

          return {
            projectId,
            plantId: resolvedPlantId,
            isFromLibrary: false,
            libraryLeverId: null,
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
