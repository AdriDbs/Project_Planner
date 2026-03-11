import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, X, ArrowRight } from 'lucide-react';
import type { WorkshopSession } from '../../../types/workshop';
import type { Lever } from '../../../types/lever';
import type { Baseline } from '../../../types/baseline';
import type { Plant } from '../../../types/project';

const PRIORITY_CHIPS = [
  'Réduire les coûts fixes',
  'Améliorer la flexibilité',
  'Digitaliser les opérations',
  'Réduire les pertes matière',
  'Optimiser les effectifs',
  'Améliorer la qualité',
  'Réduire le CAPEX',
];

const CONSTRAINT_CHIPS = [
  'Budget limité',
  'Pas de recrutement',
  'Chantiers déjà en cours',
  'Délai 18 mois max',
  'Résistance au changement',
];

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

interface AnimatedKPIProps {
  value: number;
  label: string;
  suffix?: string;
}

function AnimatedKPI({ value, label, suffix = '' }: AnimatedKPIProps) {
  return (
    <motion.div
      className="bg-white/10 rounded-2xl p-4 text-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="text-4xl font-bold text-white mb-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 1 }}
      >
        {value > 1_000_000
          ? `${(value / 1_000_000).toFixed(1)}M€`
          : value > 1000
          ? `${(value / 1000).toFixed(0)}k${suffix}`
          : `${value}${suffix}`}
      </motion.div>
      <div className="text-white/70 text-sm">{label}</div>
    </motion.div>
  );
}

interface Phase1Props {
  session: WorkshopSession;
  levers: Lever[];
  baselines: Baseline[];
  plants: Plant[];
  onUpdateSession: (updates: Partial<WorkshopSession>) => void;
  onNext: () => void;
}

export function Phase1_Context({ session, levers, baselines, plants, onUpdateSession, onNext }: Phase1Props) {
  const [customPriority, setCustomPriority] = useState('');
  const [customConstraint, setCustomConstraint] = useState('');
  const [showPriorityInput, setShowPriorityInput] = useState(false);
  const [showConstraintInput, setShowConstraintInput] = useState(false);

  const priorities = session.clientPriorities ?? [];
  const constraints = session.keyConstraints ?? [];

  const togglePriority = (p: string) => {
    const next = priorities.includes(p)
      ? priorities.filter(x => x !== p)
      : [...priorities, p];
    onUpdateSession({ clientPriorities: next });
  };

  const toggleConstraint = (c: string) => {
    const next = constraints.includes(c)
      ? constraints.filter(x => x !== c)
      : [...constraints, c];
    onUpdateSession({ keyConstraints: next });
  };

  const addCustomPriority = () => {
    if (!customPriority.trim()) return;
    onUpdateSession({ clientPriorities: [...priorities, customPriority.trim()] });
    setCustomPriority('');
    setShowPriorityInput(false);
  };

  const addCustomConstraint = () => {
    if (!customConstraint.trim()) return;
    onUpdateSession({ keyConstraints: [...constraints, customConstraint.trim()] });
    setCustomConstraint('');
    setShowConstraintInput(false);
  };

  // KPIs from baseline
  const totalConversionCost = baselines.reduce((sum, b) => {
    return sum + Object.values(b.costElements ?? {}).reduce((s, v) => s + (v as number), 0);
  }, 0);

  const totalFTE = baselines.reduce((sum, b) => {
    return sum + Object.values(b.fteByDepartment ?? {}).reduce((s, v) => s + (v as number), 0);
  }, 0);

  const selectedPlants = plants.filter(p => session.selectedPlantIds?.includes(p.id));

  // Savings donut data
  const structureSavings: Record<string, number> = {};
  levers.forEach(l => {
    if (!structureSavings[l.improvementStructure]) structureSavings[l.improvementStructure] = 0;
    structureSavings[l.improvementStructure] += l.netSavingsEUR ?? 0;
  });
  const donutData = Object.entries(structureSavings)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="flex-1 overflow-hidden grid grid-cols-2 bg-[#003057]">
      {/* Left column — Réalité financière */}
      <div className="p-8 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Réalité financière</h2>
          <p className="text-white/60 text-sm">Baseline du projet — état actuel</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <AnimatedKPI value={totalConversionCost} label="Coûts de conversion totaux" />
          <AnimatedKPI value={totalFTE} label="FTE total" suffix=" FTE" />
          <AnimatedKPI value={selectedPlants.length} label="Usines dans le périmètre" />
          <AnimatedKPI value={levers.length} label="Leviers en bibliothèque" />
        </div>

        {/* Donut chart */}
        {donutData.length > 0 && (
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-white/80 text-sm font-medium mb-3">
              Répartition des savings par nature
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1200}
                  >
                    {donutData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STRUCTURE_COLORS[entry.name] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${(value / 1_000_000).toFixed(1)}M€`, '']}
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {donutData.map(entry => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs text-white/80">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: STRUCTURE_COLORS[entry.name] ?? '#94a3b8' }}
                    />
                    <span className="flex-1">{entry.name}</span>
                    <span className="text-white/60">{(entry.value / 1_000_000).toFixed(1)}M€</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right column — Capture des priorités */}
      <div className="p-8 flex flex-col gap-6 overflow-y-auto border-l border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Priorités client</h2>
          <p className="text-white/60 text-sm">Sélectionnez les priorités pour ancrer l'atelier</p>
        </div>

        {/* Priorities */}
        <div>
          <div className="text-white/80 text-sm font-medium mb-3">Priorités stratégiques</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[...PRIORITY_CHIPS, ...priorities.filter(p => !PRIORITY_CHIPS.includes(p))].map(p => (
              <motion.button
                key={p}
                onClick={() => togglePriority(p)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  priorities.includes(p)
                    ? 'bg-white text-[#003057] shadow-lg'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {p}
                {priorities.includes(p) && !PRIORITY_CHIPS.includes(p) && (
                  <span
                    className="ml-1 opacity-60 hover:opacity-100"
                    onClick={e => { e.stopPropagation(); togglePriority(p); }}
                  >
                    ×
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          {showPriorityInput ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={customPriority}
                onChange={e => setCustomPriority(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomPriority()}
                className="flex-1 bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/60"
                placeholder="Priorité personnalisée..."
              />
              <button onClick={addCustomPriority} className="px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 text-sm">
                OK
              </button>
              <button onClick={() => setShowPriorityInput(false)} className="px-3 py-2 text-white/60 hover:text-white rounded-lg text-sm">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPriorityInput(true)}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              <Plus size={14} /> Ajouter une priorité
            </button>
          )}
        </div>

        {/* Constraints */}
        <div>
          <div className="text-white/80 text-sm font-medium mb-3">Contraintes</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[...CONSTRAINT_CHIPS, ...constraints.filter(c => !CONSTRAINT_CHIPS.includes(c))].map(c => (
              <motion.button
                key={c}
                onClick={() => toggleConstraint(c)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  constraints.includes(c)
                    ? 'bg-white text-[#003057] shadow-lg'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {c}
              </motion.button>
            ))}
          </div>

          {showConstraintInput ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={customConstraint}
                onChange={e => setCustomConstraint(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomConstraint()}
                className="flex-1 bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/60"
                placeholder="Contrainte personnalisée..."
              />
              <button onClick={addCustomConstraint} className="px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 text-sm">
                OK
              </button>
              <button onClick={() => setShowConstraintInput(false)} className="px-3 py-2 text-white/60 hover:text-white rounded-lg text-sm">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConstraintInput(true)}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              <Plus size={14} /> Ajouter une contrainte
            </button>
          )}
        </div>

        {/* CTA */}
        <div className="mt-auto">
          {priorities.length > 0 ? (
            <motion.button
              onClick={onNext}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full py-4 bg-white text-[#003057] font-bold rounded-2xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 text-base"
            >
              Démarrer la revue
              <ArrowRight size={18} />
            </motion.button>
          ) : (
            <p className="text-white/40 text-sm text-center">
              Sélectionnez au moins une priorité pour continuer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
