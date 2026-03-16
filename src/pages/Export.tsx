import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet, Download, ChevronRight, ChevronLeft,
  CheckSquare, Square, AlertTriangle, CheckCircle2,
  Loader2, Filter, Users, DollarSign, TrendingUp, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjectStore } from '../store/projectStore';
import { useProjects, usePlants } from '../hooks/useProjects';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { useBaselineV2 } from '../hooks/useBaselineV2';
import { exportProjectToExcel } from '../lib/excelExporter';
import type { Lever } from '../types/lever';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

const STEPS = ['Configuration', 'Sélection des leviers', 'Aperçu & Export'] as const;
type Step = 0 | 1 | 2;

type LeverFilter = 'all' | 'inScope' | 'commitment' | 'additional';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M €`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k €`;
  return `${value.toFixed(0)} €`;
}

// ---------------------------------------------------------------------------
// Stepper Header
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, idx) => {
        const isDone = idx < current;
        const isActive = idx === current;
        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-bp-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isDone ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? 'text-bp-primary' : isDone ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < current ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Configuration
// ---------------------------------------------------------------------------

interface Step1Props {
  projectId: string;
  setProjectId: (id: string) => void;
  filename: string;
  setFilename: (f: string) => void;
  years: number[];
  setYears: (y: number[]) => void;
  leverCount: number;
}

function Step1Config({ projectId, setProjectId, filename, setFilename, years, setYears, leverCount }: Step1Props) {
  const { projects } = useProjectStore();

  const handleYearChange = (idx: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    const next = [...years];
    next[idx] = num;
    setYears(next);
  };

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-bp-primary" />
          Projet
        </h3>
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bp-primary focus:border-transparent"
        >
          <option value="">— Sélectionner un projet —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
          ))}
        </select>
        {projectId && (
          <p className="mt-2 text-xs text-gray-500">
            {leverCount} levier{leverCount !== 1 ? 's' : ''} chargé{leverCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Filename */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-bp-primary" />
          Nom du fichier généré
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filename}
            onChange={e => setFilename(sanitizeFilename(e.target.value))}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bp-primary focus:border-transparent"
            placeholder="NomProjet_ProjectPlanner_2024"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">.xlsx</span>
        </div>
      </div>

      {/* Years */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-bp-primary" />
          Années du phasing (5 ans)
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {years.map((y, idx) => (
            <div key={idx}>
              <label className="text-xs text-gray-500 mb-1 block">Année {idx + 1}</label>
              <input
                type="number"
                value={y}
                onChange={e => handleYearChange(idx, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-bp-primary focus:border-transparent"
                min={2000}
                max={2100}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Ces années définissent les colonnes de phasing dans tous les onglets du fichier Excel.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Lever Selection
// ---------------------------------------------------------------------------

interface Step2Props {
  levers: Lever[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  plants: { id: string; name: string }[];
}

function Step2Levers({ levers, selectedIds, setSelectedIds, plants }: Step2Props) {
  const [filter, setFilter] = useState<LeverFilter>('inScope');
  const [search, setSearch] = useState('');

  const plantMap = useMemo(() => new Map(plants.map(p => [p.id, p.name])), [plants]);

  const filtered = useMemo(() => {
    let list = levers;
    if (filter === 'inScope') list = list.filter(l => l.inScope);
    else if (filter === 'commitment') list = list.filter(l => l.commitment === 'Commitment');
    else if (filter === 'additional') list = list.filter(l => l.commitment === 'Additional Potential');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q) ||
        l.improvementStructure?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [levers, filter, search]);

  const allChecked = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
  const someChecked = filtered.some(l => selectedIds.has(l.id));

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(selectedIds);
      filtered.forEach(l => next.delete(l.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach(l => next.add(l.id));
      setSelectedIds(next);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedLevers = levers.filter(l => selectedIds.has(l.id));
  const totalNetSavings = selectedLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
  const totalCapex = selectedLevers.reduce((s, l) => s + (l.capexEUR || 0), 0);

  const FILTER_OPTIONS: { value: LeverFilter; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'inScope', label: 'In Scope' },
    { value: 'commitment', label: 'Commitment only' },
    { value: 'additional', label: 'Additional Potential' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-bp-primary/5 border border-bp-primary/20 rounded-xl p-4 flex items-center gap-6">
        <span className="text-sm font-semibold text-bp-primary">
          {selectedIds.size} levier{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}
        </span>
        <span className="text-sm text-gray-600">Net Savings: <strong>{formatK(totalNetSavings)}</strong></span>
        <span className="text-sm text-gray-600">CAPEX: <strong>{formatK(totalCapex)}</strong></span>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === opt.value
                ? 'bg-bp-primary text-white border-bp-primary'
                : 'bg-white text-gray-600 border-gray-300 hover:border-bp-primary hover:text-bp-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-bp-primary focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <button onClick={toggleAll} className="text-gray-500 hover:text-bp-primary">
                    {allChecked ? (
                      <CheckSquare size={16} className="text-bp-primary" />
                    ) : someChecked ? (
                      <CheckSquare size={16} className="text-bp-primary/50" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-gray-600 font-semibold">Levier</th>
                <th className="px-3 py-3 text-left text-gray-600 font-semibold">Usine</th>
                <th className="px-3 py-3 text-left text-gray-600 font-semibold">Département</th>
                <th className="px-3 py-3 text-left text-gray-600 font-semibold">Structure</th>
                <th className="px-3 py-3 text-right text-gray-600 font-semibold">Net Savings</th>
                <th className="px-3 py-3 text-right text-gray-600 font-semibold">CAPEX</th>
                <th className="px-3 py-3 text-center text-gray-600 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Aucun levier correspondant
                  </td>
                </tr>
              ) : (
                filtered.map((lever, idx) => {
                  const checked = selectedIds.has(lever.id);
                  return (
                    <tr
                      key={lever.id}
                      className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      } ${checked ? 'bg-bp-primary/5' : ''}`}
                      onClick={() => toggle(lever.id)}
                    >
                      <td className="px-3 py-2 text-center">
                        {checked ? (
                          <CheckSquare size={14} className="text-bp-primary mx-auto" />
                        ) : (
                          <Square size={14} className="text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        <p className="truncate font-medium text-gray-800">{lever.title || lever.leverId}</p>
                        <p className="text-gray-400">{lever.leverId}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {plantMap.get(lever.plantId) || lever.plantId}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{lever.department}</td>
                      <td className="px-3 py-2 text-gray-600">{lever.improvementStructure}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {formatK(lever.netSavingsEUR || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {formatK(lever.capexEUR || 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            lever.commitment === 'Commitment'
                              ? 'bg-green-100 text-green-700'
                              : lever.commitment === 'Additional Potential'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {lever.commitment === 'Commitment'
                            ? 'Commit.'
                            : lever.commitment === 'Additional Potential'
                            ? 'Add. Pot.'
                            : 'No Go'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-right">
        {filtered.length} levier{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
        {' · '}{levers.length} au total
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Preview & Export
// ---------------------------------------------------------------------------

interface Step3Props {
  selectedLevers: Lever[];
  plants: { id: string; name: string }[];
  baselines: { plantId: string }[];
  onExport: () => void;
  exporting: boolean;
  exportDone: boolean;
  exportedFilename: string;
}

function Step3Preview({ selectedLevers, plants, baselines, onExport, exporting, exportDone, exportedFilename }: Step3Props) {
  const commitment = selectedLevers.filter(l => l.commitment === 'Commitment');
  const additional = selectedLevers.filter(l => l.commitment === 'Additional Potential');
  const commitNetSavings = commitment.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
  const fullNetSavings = selectedLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
  const totalCapex = commitment.reduce((s, l) => s + (l.capexEUR || 0), 0);
  const totalFTE = commitment.reduce((s, l) => s + (l.fte || 0), 0);
  const coveredPlants = new Set(selectedLevers.map(l => l.plantId)).size;
  const plantsWithoutBaseline = plants.filter(p => !baselines.find(b => b.plantId === p.id));

  const cards = [
    {
      icon: <FileSpreadsheet size={20} className="text-bp-primary" />,
      label: 'Leviers inclus',
      value: String(selectedLevers.length),
      sub: `Commit: ${commitment.length} · Add. Pot.: ${additional.length}`,
    },
    {
      icon: <TrendingUp size={20} className="text-green-600" />,
      label: 'Net Savings (Commitment)',
      value: formatK(commitNetSavings),
      sub: `Full Potential: ${formatK(fullNetSavings)}`,
    },
    {
      icon: <DollarSign size={20} className="text-blue-600" />,
      label: 'CAPEX total',
      value: formatK(totalCapex),
      sub: `Leviers Commitment`,
    },
    {
      icon: <Users size={20} className="text-purple-600" />,
      label: 'FTE savings',
      value: `${totalFTE.toFixed(1)} FTE`,
      sub: `Leviers Commitment`,
    },
    {
      icon: <Building2 size={20} className="text-orange-500" />,
      label: 'Usines couvertes',
      value: `${coveredPlants} / ${plants.length}`,
      sub: `sur ${plants.length} usine${plants.length !== 1 ? 's' : ''} du projet`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {plantsWithoutBaseline.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Baselines manquantes</p>
            <p className="text-xs text-yellow-700 mt-1">
              {plantsWithoutBaseline.length} usine{plantsWithoutBaseline.length > 1 ? 's' : ''} sans baseline :{' '}
              <strong>{plantsWithoutBaseline.map(p => p.name).join(', ')}</strong>.
              Les colonnes baseline seront à 0 dans l'onglet Baselines.
            </p>
          </div>
        </div>
      )}

      {selectedLevers.length > 500 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            <strong>{selectedLevers.length} leviers sélectionnés</strong> — la génération peut prendre quelques secondes.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-xs text-gray-500 font-medium">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Sheets list */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Onglets générés (9 + 4 Baseline)</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            'Performance Levers',
            'Executive Summary',
            'Synthesis',
            'Baselines',
            'Phasing Savings CS',
            'Phasing Savings DP',
            'Phasing Organization',
            'Phasing CAPEX & OPEX',
            'Out of Scope',
            'Baseline - Cost Element',
            'Baseline - Department',
            'Baseline - FTE',
            'Baseline - Volumes',
          ].map(sheet => (
            <div key={sheet} className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
              {sheet}
            </div>
          ))}
        </div>
      </div>

      {/* Export button */}
      <div className="flex flex-col items-center gap-3">
        {exportDone ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 w-full">
            <CheckCircle2 size={20} className="text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">Fichier généré avec succès !</p>
              <p className="text-xs text-green-700">{exportedFilename}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={onExport}
            disabled={exporting || selectedLevers.length === 0}
            className="flex items-center gap-3 bg-bp-primary hover:bg-bp-primary/90 disabled:bg-gray-300 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-bp-primary/20"
          >
            {exporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Download size={18} />
                Générer et Télécharger Excel
              </>
            )}
          </button>
        )}
        {selectedLevers.length === 0 && (
          <p className="text-xs text-red-500">Sélectionnez au moins un levier.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export Page
// ---------------------------------------------------------------------------

export function ExportPage() {
  const { selectedProjectId, projects, selectedYears } = useProjectStore();
  const { projects: allProjects } = useProjects();

  const [step, setStep] = useState<Step>(0);
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');
  const [years, setYears] = useState<number[]>(
    selectedYears.length >= 5 ? selectedYears.slice(0, 5) : [...selectedYears, ...Array.from({ length: 5 - selectedYears.length }, (_, i) => (selectedYears[selectedYears.length - 1] || new Date().getFullYear()) + i + 1)],
  );

  const project = useMemo(() => projects.find(p => p.id === projectId) || null, [projects, projectId]);
  const [filename, setFilename] = useState('');

  React.useEffect(() => {
    if (project) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      setFilename(sanitizeFilename(`${project.name}_ProjectPlanner_${today}`));
    }
  }, [project]);

  const { plants } = usePlants(projectId || null);
  const { levers, loading: leversLoading } = useLevers(projectId || null);
  const { baselines } = useBaseline(projectId || null);
  const { baselines: baselinesV2 } = useBaselineV2(projectId || null);

  // Auto-select all inScope levers when project changes
  React.useEffect(() => {
    if (levers.length > 0) {
      setSelectedIds(new Set(levers.filter(l => l.inScope).map(l => l.id)));
    }
  }, [levers]);

  const selectedLevers = useMemo(() => levers.filter(l => selectedIds.has(l.id)), [levers, selectedIds]);

  const canGoNext = useMemo(() => {
    if (step === 0) return !!projectId && project !== null && years.length === 5;
    if (step === 1) return selectedIds.size > 0;
    return true;
  }, [step, projectId, project, years, selectedIds]);

  const handleExport = async () => {
    if (!project || selectedLevers.length === 0) return;
    setExporting(true);
    setExportDone(false);
    try {
      // Small delay to allow spinner to render before heavy computation
      await new Promise(resolve => setTimeout(resolve, 100));

      const fname = `${filename || sanitizeFilename(project.name + '_ProjectPlanner')}`;
      exportProjectToExcel({
        project,
        plants,
        levers: selectedLevers,
        baselines,
        years,
        filename: fname,
        baselineV2: {
          costElement: baselinesV2.cost_element as any,
          department: baselinesV2.department as any,
          fte: baselinesV2.fte_department as any,
          volumes: baselinesV2.volumes as any,
        },
      });
      setExportedFilename(fname + '.xlsx');
      setExportDone(true);
      toast.success(`Fichier ${fname}.xlsx téléchargé !`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération du fichier.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-bp-primary rounded-xl flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Export Excel — BBACM Project Planner</h1>
            <p className="text-sm text-gray-500">Générez un fichier .xlsx complet et immédiatement utilisable</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="min-h-64">
        {step === 0 && (
          <Step1Config
            projectId={projectId}
            setProjectId={(id) => {
              setProjectId(id);
              setSelectedIds(new Set());
              setExportDone(false);
            }}
            filename={filename}
            setFilename={setFilename}
            years={years}
            setYears={setYears}
            leverCount={levers.length}
          />
        )}
        {step === 1 && (
          leversLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              Chargement des leviers…
            </div>
          ) : (
            <Step2Levers
              levers={levers}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              plants={plants}
            />
          )
        )}
        {step === 2 && (
          <Step3Preview
            selectedLevers={selectedLevers}
            plants={plants}
            baselines={baselines}
            onExport={handleExport}
            exporting={exporting}
            exportDone={exportDone}
            exportedFilename={exportedFilename}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => { setStep((s) => Math.max(0, s - 1) as Step); setExportDone(false); }}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Précédent
        </button>

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => Math.min(2, s + 1) as Step)}
            disabled={!canGoNext}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-bp-primary text-white text-sm font-semibold hover:bg-bp-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleExport}
            disabled={exporting || selectedLevers.length === 0 || exportDone}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Génération…' : 'Générer & Télécharger'}
          </button>
        )}
      </div>
    </div>
  );
}
