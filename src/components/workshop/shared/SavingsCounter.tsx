import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import type { ComputedSavings, WorkshopParticipant } from '../../../types/workshop';

interface AnimatedValueProps {
  value: number;
  decimals?: number;
  suffix?: string;
}

function AnimatedValue({ value, decimals = 1, suffix = '' }: AnimatedValueProps) {
  const spring = useSpring(value, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (v) =>
    (v / 1_000_000).toFixed(decimals)
  );

  React.useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span>
      {display}
      {suffix}
    </motion.span>
  );
}

interface SavingsCounterProps {
  computedSavings: ComputedSavings;
  participants?: WorkshopParticipant[];
  showTerrain?: boolean;
}

export function SavingsCounter({ computedSavings, participants = [], showTerrain = false }: SavingsCounterProps) {
  const { total, library, terrain, totalCapex, totalFTE, percentOfBaseline } = computedSavings;

  const pct = Math.round(percentOfBaseline * 100);
  const pctBars = Math.min(Math.round(pct / 10), 10);

  return (
    <div className="w-60 bg-white border border-gray-200 rounded-xl p-4 space-y-4 text-sm flex-shrink-0">
      {/* Main savings */}
      {showTerrain ? (
        <>
          {/* Library */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <span>📚</span> Leviers bibliothèque
            </div>
            <div className="text-2xl font-bold text-bp-primary">
              <AnimatedValue value={library.full} />
              <span className="text-sm font-normal ml-1">M€</span>
            </div>
            <div className="text-xs text-gray-400">Phase 2</div>
          </div>

          {/* Terrain */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <span>🆕</span> Leviers terrain
            </div>
            <div className="text-2xl font-bold text-green-600">
              <AnimatedValue value={terrain.full} />
              <span className="text-sm font-normal ml-1">M€</span>
            </div>
            <div className="text-xs text-gray-400">Phase 3</div>
          </div>

          <div className="border-t border-gray-100 pt-2">
            <div className="text-xs text-gray-500 mb-1">TOTAL</div>
            <div className="text-3xl font-bold text-bp-primary">
              <AnimatedValue value={total.full} />
              <span className="text-base font-normal ml-1">M€</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="text-xs text-gray-500 mb-1">💰 Potentiel validé</div>
            <div className="text-3xl font-bold text-bp-primary leading-none">
              <AnimatedValue value={total.full} />
              <span className="text-base font-normal ml-1">M€</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">NET SAVINGS</div>
          </div>
        </>
      )}

      {/* Commitment breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Commitment</span>
          <span className="font-semibold text-green-700 text-xs">
            {(total.commitment / 1_000_000).toFixed(1)} M€
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            animate={{ width: total.full > 0 ? `${(total.commitment / total.full) * 100}%` : '0%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Add. Potential</span>
          <span className="font-semibold text-blue-600 text-xs">
            {((total.full - total.commitment) / 1_000_000).toFixed(1)} M€
          </span>
        </div>
      </div>

      {/* CAPEX */}
      <div className="border-t border-gray-100 pt-2">
        <div className="text-xs text-gray-500 mb-1">CAPEX requis</div>
        <div className="font-bold text-gray-800">
          {(totalCapex / 1_000_000).toFixed(1)} M€
        </div>
      </div>

      {/* FTE */}
      {totalFTE > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">FTE savings</div>
          <div className="font-bold text-gray-800">{totalFTE} FTE</div>
        </div>
      )}

      {/* % baseline */}
      {pct > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">% baseline CC</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-sm ${i < pctBars ? 'bg-bp-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      {participants.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-2">Participants actifs</div>
          <div className="space-y-1">
            {participants.slice(0, 5).map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                <span className={p.isRemote ? 'text-yellow-500' : 'text-green-500'}>●</span>
                <span className={`truncate ${p.isRemote ? 'text-gray-400' : 'text-gray-700'}`}>
                  {p.name} {p.isRemote ? '(remote)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
