import React from 'react';
import { useBaselineV2 } from '../../hooks/useBaselineV2';
import type { BaselineType, BaselineMatrix, BaselineVolumes } from '../../types/baseline';

interface BaselineSummaryCardProps {
  type: BaselineType;
  projectId: string;
  plantFilter?: string;      // optional: filter to a specific plant name
  showTotalsOnly?: boolean;  // true = show only the Total rows
}

export function BaselineSummaryCard({ type, projectId, plantFilter, showTotalsOnly = false }: BaselineSummaryCardProps) {
  const { baselines, loading } = useBaselineV2(projectId);
  const entry = baselines[type];

  const isLoading = loading[type];

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-3 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="card text-center py-6 text-gray-400 text-sm">
        Aucune donnée baseline ({type})
      </div>
    );
  }

  const typeLabel: Record<BaselineType, string> = {
    cost_element: 'Cost Element',
    department: 'Department',
    fte_department: 'FTE / Department',
    volumes: 'Volumes',
  };

  const isFTE = type === 'fte_department';
  const isVolumes = type === 'volumes';

  const fmtVal = (v: number) => {
    if (isVolumes) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v);
    if (isFTE) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
    // cost: display in k€
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v / 1000));
  };

  if (isVolumes) {
    const vol = entry as BaselineVolumes;
    const rows = plantFilter
      ? vol.rows.filter(r => r.plant === plantFilter)
      : vol.rows;
    const total = rows.reduce((s, r) => s + r.volume, 0);

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">{typeLabel[type]}</span>
          {vol.referenceLabel && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{vol.referenceLabel}</span>
          )}
        </div>
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 truncate">{row.platform} — {row.plant}</span>
              <span className="font-mono font-medium text-gray-800 ml-2">{fmtVal(row.volume)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-2">
            <span className="text-bp-primary">Total</span>
            <span className="font-mono text-bp-primary">{fmtVal(total)}</span>
          </div>
        </div>
      </div>
    );
  }

  const matrix = entry as BaselineMatrix;
  const unit = isFTE ? 'FTE' : 'k€';

  let rows = showTotalsOnly
    ? matrix.rows.filter(r => r.isCalculated)
    : matrix.rows;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">{typeLabel[type]} ({unit})</span>
        {matrix.referenceLabel && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{matrix.referenceLabel}</span>
        )}
      </div>
      <div className="space-y-1">
        {rows.map(row => {
          const value = plantFilter
            ? (row.values[plantFilter] ?? 0)
            : row.total;

          return (
            <div
              key={row.label}
              className={`flex items-center justify-between text-sm ${
                row.isCalculated ? 'font-semibold border-t border-gray-100 pt-1.5 mt-1' : ''
              }`}
            >
              <span className={row.isCalculated ? 'text-bp-primary' : 'text-gray-600'}>
                {row.label}
              </span>
              <span className={`font-mono ml-2 ${row.isCalculated ? 'text-bp-primary' : 'text-gray-800'}`}>
                {fmtVal(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
