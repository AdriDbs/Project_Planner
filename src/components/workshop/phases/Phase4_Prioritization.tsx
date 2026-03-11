import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';
import type { WorkshopSession, LeversByQuadrant, QuadrantLeverItem } from '../../../types/workshop';

const STRUCTURE_COLORS: Record<string, string> = {
  DLC: '#003057',
  PILC: '#00A3E0',
  OVC: '#FF6200',
  'FC-Personal': '#00B050',
  Maintenance: '#FFC000',
  OFC: '#7C3AED',
  'RM Losses': '#DC2626',
  'PM Losses': '#EA580C',
};

const EFFORT_X: Record<string, number> = {
  easy: 1,
  medium: 2,
  complex: 3,
};

const QUADRANT_LABELS = {
  quick_wins: { label: 'Quick Wins', bg: 'rgba(0,176,80,0.05)', color: '#00B050' },
  big_bets: { label: 'Grands Chantiers', bg: 'rgba(0,163,224,0.05)', color: '#00A3E0' },
  fill_in: { label: 'Fill-in', bg: 'rgba(0,0,0,0.02)', color: '#94a3b8' },
  challenge: { label: 'À challenger', bg: 'rgba(255,98,0,0.05)', color: '#FF6200' },
};

interface Phase4Props {
  session: WorkshopSession;
  leversByQuadrant: LeversByQuadrant;
  debatedCount: number;
  libraryCount: number;
  terrainCount: number;
  onBack: () => void;
}

interface ScatterPoint extends QuadrantLeverItem {
  x: number;
  y: number;
  z: number;
  quadrant: keyof LeversByQuadrant;
}

function QuadrantCard({ quadrant, items, label, color }: {
  quadrant: keyof LeversByQuadrant;
  items: QuadrantLeverItem[];
  label: string;
  color: string;
}) {
  if (items.length === 0) return null;
  const totalSavings = items.reduce((s, i) => s + i.savings, 0);
  const terrainCount = items.filter(i => i.isNewLever).length;
  const visible = items.slice(0, 3);
  const more = items.length - 3;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        <span className="text-xs text-gray-500">{items.length} leviers · {(totalSavings / 1_000_000).toFixed(1)} M€</span>
      </div>
      {terrainCount > 0 && (
        <div className="text-xs text-blue-600">dont {terrainCount} levier{terrainCount > 1 ? 's' : ''} terrain 🆕</div>
      )}
      <div className="border-t border-gray-100 pt-2 space-y-1">
        {visible.map(item => (
          <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="truncate flex-1">
              {item.isNewLever && <span className="mr-1">🆕</span>}
              {item.title}
            </span>
            {item.owner && <span className="text-gray-400">{item.owner}</span>}
            {item.targetQuarter && <span className="text-gray-400">{item.targetQuarter}</span>}
          </div>
        ))}
        {more > 0 && (
          <div className="text-xs text-gray-400">+ {more} autre{more > 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs space-y-1 max-w-56">
      <p className="font-semibold text-gray-800 leading-snug">{p.title}</p>
      <p className="text-gray-500">{p.improvementStructure}</p>
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-100">
        <div><span className="text-gray-400">Savings:</span> <span className="font-medium">{(p.savings / 1000).toFixed(0)}k€</span></div>
        <div><span className="text-gray-400">CAPEX:</span> <span className="font-medium">{(p.capex / 1000).toFixed(0)}k€</span></div>
        {p.owner && <div><span className="text-gray-400">Owner:</span> <span className="font-medium">{p.owner}</span></div>}
        {p.targetQuarter && <div><span className="text-gray-400">Quarter:</span> <span className="font-medium">{p.targetQuarter}</span></div>}
      </div>
      <div className="flex items-center gap-1">
        {p.isNewLever && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">🆕 Terrain</span>}
        {!p.isNewLever && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">📚 Bibliothèque</span>}
        {p.commitment && <span className={`px-1.5 py-0.5 rounded-full ${p.commitment === 'Commitment' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>{p.commitment}</span>}
      </div>
    </div>
  );
};

export function Phase4_Prioritization({
  session, leversByQuadrant, debatedCount, libraryCount, terrainCount, onBack
}: Phase4Props) {
  const allPoints = useMemo((): ScatterPoint[] => {
    const result: ScatterPoint[] = [];
    (Object.entries(leversByQuadrant) as [keyof LeversByQuadrant, QuadrantLeverItem[]][]).forEach(([quadrant, items]) => {
      items.forEach(item => {
        const x = EFFORT_X[item.effort ?? 'medium'] ?? 2;
        // Add jitter for readability
        const jitterX = x + (Math.random() - 0.5) * 0.3;
        result.push({
          ...item,
          x: jitterX,
          y: item.savings / 1000, // in k€
          z: Math.max(8, Math.min(32, (item.capex / 1000) * 0.5 + 10)),
          quadrant,
        });
      });
    });
    return result;
  }, [leversByQuadrant]);

  const totalCount = libraryCount + terrainCount;

  return (
    <div className="flex-1 overflow-hidden flex gap-0">
      {/* Left: Matrix (65%) */}
      <div className="flex-[65] p-6 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">Matrice Effort × Impact</h2>
          <p className="text-sm text-gray-500 mt-1">
            {libraryCount} leviers bibliothèque + {terrainCount} leviers terrain
            {debatedCount > 0 && ` — ${debatedCount} levier${debatedCount > 1 ? 's' : ''} en débat non inclus`}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 relative" style={{ height: 480 }}>
          {/* Quadrant backgrounds */}
          <div className="absolute inset-x-[50px] inset-y-[40px] pointer-events-none">
            <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
              {[
                { label: 'Quick Wins', bg: QUADRANT_LABELS.quick_wins.bg, color: QUADRANT_LABELS.quick_wins.color },
                { label: 'Grands Chantiers', bg: QUADRANT_LABELS.big_bets.bg, color: QUADRANT_LABELS.big_bets.color },
                { label: 'Fill-in', bg: QUADRANT_LABELS.fill_in.bg, color: QUADRANT_LABELS.fill_in.color },
                { label: 'À challenger', bg: QUADRANT_LABELS.challenge.bg, color: QUADRANT_LABELS.challenge.color },
              ].map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-start p-2"
                  style={{
                    background: q.bg,
                    justifyContent: idx % 2 === 0 ? 'flex-end' : 'flex-start',
                    order: idx < 2 ? idx : idx, // Top row first
                  }}
                >
                  <span className="text-xs font-semibold opacity-60" style={{ color: q.color }}>
                    {q.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                domain={[0.5, 3.5]}
                tickCount={3}
                tickFormatter={(v) => v < 1.5 ? 'Facile' : v < 2.5 ? 'Moyen' : 'Complexe'}
                label={{ value: 'Effort', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Savings"
                tickFormatter={(v) => `${v}k€`}
                label={{ value: 'Impact (k€/an)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={allPoints}>
                {allPoints.map((point, idx) => (
                  <Cell
                    key={idx}
                    fill={STRUCTURE_COLORS[point.improvementStructure] ?? '#94a3b8'}
                    opacity={0.8}
                    stroke={point.isNewLever ? '#1d4ed8' : 'transparent'}
                    strokeWidth={point.isNewLever ? 2 : 0}
                    strokeDasharray={point.isNewLever ? '4 2' : '0'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gray-300 border-2 border-dashed border-blue-500" />
            <span>Leviers terrain (Phase 3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gray-300" />
            <span>Leviers bibliothèque</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gray-300 opacity-30 scale-75" />
            <div className="w-4 h-4 rounded-full bg-gray-300 opacity-70" />
            <div className="w-4 h-4 rounded-full bg-gray-300 scale-125" />
            <span>Taille = CAPEX</span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="mt-4 text-sm text-bp-secondary hover:text-bp-primary transition-colors"
        >
          ← Ajuster les décisions (Phase 2)
        </button>
      </div>

      {/* Right: Quadrant summary (35%) */}
      <div className="flex-[35] border-l border-gray-200 p-4 overflow-y-auto space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Synthèse par quadrant</h3>

        {(Object.entries(leversByQuadrant) as [keyof LeversByQuadrant, QuadrantLeverItem[]][]).map(([key, items]) => (
          <QuadrantCard
            key={key}
            quadrant={key}
            items={items}
            label={QUADRANT_LABELS[key].label}
            color={QUADRANT_LABELS[key].color}
          />
        ))}

        {totalCount === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Validez des leviers en Phase 2 et créez des leviers en Phase 3 pour voir la matrice.
          </p>
        )}
      </div>
    </div>
  );
}
