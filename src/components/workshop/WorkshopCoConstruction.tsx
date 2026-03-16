import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  X, ChevronLeft, ChevronRight, Check, Plus, Trash2, CheckSquare, Square,
  Filter, AlertTriangle,
} from 'lucide-react';
import { useWorkshopStore } from '../../store/workshopStore';
import { useProjectStore } from '../../store/projectStore';
import { useWorkshops } from '../../hooks/useWorkshops';
import { useLevers } from '../../hooks/useLevers';
import { usePlants } from '../../hooks/useProjects';
import { useProjects } from '../../hooks/useProjects';
import type { Workshop, WorkshopPhase, WorkshopLeverSelection } from '../../types/workshop';
import type { Lever } from '../../types/lever';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASES: { key: WorkshopPhase; label: string; short: string }[] = [
  { key: 'setup',        label: 'Configuration',    short: 'Setup'       },
  { key: 'lever_library',label: 'Bibliothèque',     short: 'Library'     },
  { key: 'selection',    label: 'Sélection',        short: 'Sélection'   },
  { key: 'scoring',      label: 'Scoring',          short: 'Scoring'     },
  { key: 'commitment',   label: 'Commitment',       short: 'Commitment'  },
  { key: 'synthesis',    label: 'Synthèse',         short: 'Synthèse'    },
];

const PHASE_INDEX: Record<WorkshopPhase, number> = {
  setup: 0, lever_library: 1, selection: 2, scoring: 3, commitment: 4, synthesis: 5,
};

function phaseIndex(phase: WorkshopPhase): number {
  return PHASE_INDEX[phase];
}

function nextPhase(phase: WorkshopPhase): WorkshopPhase | null {
  const idx = phaseIndex(phase);
  return idx < PHASES.length - 1 ? PHASES[idx + 1].key : null;
}

function prevPhase(phase: WorkshopPhase): WorkshopPhase | null {
  const idx = phaseIndex(phase);
  return idx > 0 ? PHASES[idx - 1].key : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtSavings(v: number): string {
  if (!v) return '0 k€';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} k€`;
}

function scoreColor(score: number): string {
  if (score >= 3.5) return 'text-green-400';
  if (score >= 2.5) return 'text-yellow-400';
  return 'text-red-400';
}

function defaultCommitment(score: number): 'Commitment' | 'Additional Potential' | 'No Go' {
  if (score >= 3.5) return 'Commitment';
  if (score >= 2.5) return 'Additional Potential';
  return 'No Go';
}

// ─── Phase Indicator ─────────────────────────────────────────────────────────

function PhaseIndicator({ current }: { current: WorkshopPhase }) {
  const currentIdx = phaseIndex(current);
  return (
    <div className="flex items-center gap-1">
      {PHASES.map((p, i) => {
        const isPast    = i < currentIdx;
        const isActive  = i === currentIdx;
        const isFuture  = i > currentIdx;
        return (
          <React.Fragment key={p.key}>
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${
                isActive  ? 'bg-[#e8451a] border-[#e8451a] text-white'
                : isPast  ? 'bg-green-500 border-green-500 text-white'
                : isFuture? 'bg-[#1e2d45] border-[#1e2d45] text-gray-400'
                : ''
              }`}
            >
              {isPast ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-6 h-0.5 ${isPast ? 'bg-green-500' : 'bg-[#1e2d45]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Score Dots ──────────────────────────────────────────────────────────────

function ScoreDots({
  value, max = 5, onChange, color = '#e8451a',
}: {
  value: number; max?: number; onChange?: (v: number) => void; color?: string;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i + 1)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            i < value
              ? 'border-transparent'
              : 'bg-transparent border-gray-600'
          } ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          style={i < value ? { backgroundColor: color } : {}}
        />
      ))}
    </div>
  );
}

// ─── Quit Confirm Modal ───────────────────────────────────────────────────────

function QuitConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-[#111827] border border-[#1e2d45] rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
          <h3 className="text-white font-semibold text-lg">Quitter le workshop ?</h3>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Le workshop sera sauvegardé et vous pourrez le reprendre ultérieurement depuis la page Workshop.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#1e2d45] text-gray-300 hover:border-gray-500 transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium"
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lever Drawer (Phase 3) ──────────────────────────────────────────────

interface QuickLeverData {
  leverId: string;
  title: string;
  department: string;
  improvementStructure: string;
}

function AddLeverDrawer({
  projectId,
  plantId,
  onClose,
  onCreated,
}: {
  projectId: string;
  plantId: string;
  onClose: () => void;
  onCreated: (lever: Lever) => void;
}) {
  const { createLever } = useLevers(null);
  const [form, setForm] = useState<QuickLeverData>({
    leverId: '', title: '', department: '', improvementStructure: '',
  });
  const [saving, setSaving] = useState(false);

  const depts = [
    'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing',
    'Quality', 'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering',
  ];
  const structures = [
    'DLC', 'PILC', 'OVC', 'FC-Personal', 'Maintenance', 'OFC', 'RM Losses', 'PM Losses',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leverId || !form.title || !form.department || !form.improvementStructure) {
      toast.error('Renseignez tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const id = await createLever({
        projectId,
        plantId,
        leverId: form.leverId,
        title: form.title,
        department: form.department as Lever['department'],
        improvementStructure: form.improvementStructure as Lever['improvementStructure'],
        source: 'On-site Workshop',
        platform: '',
        leverType: 'Operational Basics',
        digitalizationMechanization: 'Other Lever Type',
        inBudget: false,
        inScope: true,
        savingsByYear: {},
        fyTotalSavingsLC: 0,
        capexLC: 0,
        approvedCapexLC: 0,
        oneOffOpexLC: 0,
        recurringOpexLC: 0,
        netSavingsLC: 0,
        fyTotalSavingsEUR: 0,
        capexEUR: 0,
        approvedCapexEUR: 0,
        oneOffOpexEUR: 0,
        recurringOpexEUR: 0,
        netSavingsEUR: 0,
        payback: 0,
        benefits: 3,
        feasibility: 3,
        commitment: 'Commitment',
        comment: '',
        fteSavingsType: 'Not impacting',
        fte: 0,
        oeeOrFte: '',
        gy: [],
        oee: [],
        ht: [],
        rmLosses: 0,
        pmLosses: 0,
        implementationStart: '',
        implementationEnd: '',
        projectDurationMonths: 0,
        capexImpactYear: '',
        kpiImpactYear: '',
        libraryLeverId: null,
        isFromLibrary: false,
      });
      onCreated({ id, projectId, plantId, ...form } as unknown as Lever);
      toast.success('Levier créé');
      onClose();
    } catch {
      toast.error('Erreur lors de la création du levier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[10001] w-96 bg-[#111827] border-l border-[#1e2d45] shadow-2xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[#1e2d45]">
        <h3 className="text-white font-semibold">Nouveau levier</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">ID Levier *</label>
          <input
            value={form.leverId}
            onChange={e => setForm(f => ({ ...f, leverId: e.target.value }))}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#e8451a] outline-none"
            placeholder="ex: MF30"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Titre *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#e8451a] outline-none"
            placeholder="Titre du levier"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Département *</label>
          <select
            value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#e8451a] outline-none"
            required
          >
            <option value="">Sélectionner...</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Structure d'amélioration *</label>
          <select
            value={form.improvementStructure}
            onChange={e => setForm(f => ({ ...f, improvementStructure: e.target.value }))}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#e8451a] outline-none"
            required
          >
            <option value="">Sélectionner...</option>
            {structures.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#e8451a] hover:bg-[#d03d16] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {saving ? 'Création...' : 'Créer le levier'}
        </button>
      </form>
    </div>
  );
}

// ─── Phase 1 — Setup ─────────────────────────────────────────────────────────

interface Phase1Props {
  projectId: string;
  plants: { id: string; name: string }[];
  onWorkshopCreated: (workshop: Workshop) => void;
  existingWorkshop: Workshop | null;
}

function Phase1Setup({ projectId, plants, onWorkshopCreated, existingWorkshop }: Phase1Props) {
  const { createWorkshop, updateWorkshop } = useWorkshops(projectId);
  const [name, setName] = useState(existingWorkshop?.name || '');
  const [plantId, setPlantId] = useState(existingWorkshop?.plantId || '');
  const [facilitator, setFacilitator] = useState(existingWorkshop?.facilitator || '');
  const [participants, setParticipants] = useState<string[]>(existingWorkshop?.participants || []);
  const [participantInput, setParticipantInput] = useState('');
  const [date, setDate] = useState(existingWorkshop?.date || today());
  const [saving, setSaving] = useState(false);

  // Auto-generate name when plant is selected
  useEffect(() => {
    if (!existingWorkshop && plantId) {
      const plant = plants.find(p => p.id === plantId);
      if (plant) {
        const d = new Date().toLocaleDateString('fr-FR');
        setName(`Workshop ${plant.name} - ${d}`);
      }
    }
  }, [plantId, plants, existingWorkshop]);

  const addParticipant = () => {
    const trimmed = participantInput.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants(ps => [...ps, trimmed]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (p: string) => {
    setParticipants(ps => ps.filter(x => x !== p));
  };

  const handleStart = async () => {
    if (!name || !plantId || !facilitator) {
      toast.error('Renseignez le nom, l\'usine et le facilitateur');
      return;
    }
    setSaving(true);
    try {
      if (existingWorkshop) {
        await updateWorkshop(existingWorkshop.id, {
          name, plantId, facilitator, participants, date,
          status: 'in_progress',
          currentPhase: 'lever_library',
        });
        onWorkshopCreated({ ...existingWorkshop, name, plantId, facilitator, participants, date, currentPhase: 'lever_library' });
      } else {
        const id = await createWorkshop({
          projectId,
          plantId,
          name,
          status: 'in_progress',
          currentPhase: 'lever_library',
          facilitator,
          participants,
          date,
          leverSelections: {},
          notes: '',
        });
        onWorkshopCreated({
          id, projectId, plantId, name, status: 'in_progress',
          currentPhase: 'lever_library', facilitator, participants, date,
          leverSelections: {}, notes: '',
          createdAt: new Date(), updatedAt: new Date(),
        });
      }
    } catch {
      toast.error('Erreur lors de la création du workshop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-white text-2xl font-bold mb-2">Configuration du Workshop</h2>
      <p className="text-gray-400 text-sm mb-8">Renseignez les informations de base avant de démarrer.</p>

      <div className="space-y-5">
        {/* Plant */}
        <div>
          <label className="text-sm text-gray-300 mb-1.5 block font-medium">Usine *</label>
          <select
            value={plantId}
            onChange={e => setPlantId(e.target.value)}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e8451a] outline-none"
          >
            <option value="">Sélectionner une usine...</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm text-gray-300 mb-1.5 block font-medium">Nom du workshop *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e8451a] outline-none"
            placeholder="Workshop Manufacturing - Cairo - 15/03/2026"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-sm text-gray-300 mb-1.5 block font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e8451a] outline-none"
          />
        </div>

        {/* Facilitator */}
        <div>
          <label className="text-sm text-gray-300 mb-1.5 block font-medium">Facilitateur *</label>
          <input
            value={facilitator}
            onChange={e => setFacilitator(e.target.value)}
            className="w-full bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e8451a] outline-none"
            placeholder="Nom du consultant BearingPoint"
          />
        </div>

        {/* Participants */}
        <div>
          <label className="text-sm text-gray-300 mb-1.5 block font-medium">Participants</label>
          <div className="flex gap-2 mb-2">
            <input
              value={participantInput}
              onChange={e => setParticipantInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(); } }}
              className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e8451a] outline-none"
              placeholder="Nom du participant"
            />
            <button
              type="button"
              onClick={addParticipant}
              className="bg-[#1e2d45] hover:bg-[#2a3d55] text-white rounded-xl px-4 py-2.5 text-sm transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <span
                  key={p}
                  className="flex items-center gap-1.5 bg-[#1e2d45] text-gray-300 text-xs rounded-full px-3 py-1"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removeParticipant(p)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleStart}
          disabled={saving}
          className="w-full bg-[#e8451a] hover:bg-[#d03d16] disabled:opacity-50 text-white rounded-xl px-6 py-3 font-semibold text-base transition-colors flex items-center justify-center gap-2"
        >
          {saving ? 'Création...' : 'Démarrer le workshop →'}
        </button>
      </div>
    </div>
  );
}

// ─── Lever Card ───────────────────────────────────────────────────────────────

function LeverCard({
  lever,
  selected,
  selectable,
  onToggle,
}: {
  lever: Lever;
  selected?: boolean;
  selectable?: boolean;
  onToggle?: () => void;
}) {
  const commitColor = {
    'Commitment': 'text-green-400 border-green-700 bg-green-900/20',
    'Additional Potential': 'text-blue-400 border-blue-700 bg-blue-900/20',
    'No Go': 'text-red-400 border-red-700 bg-red-900/20',
  }[lever.commitment || 'No Go'] ?? 'text-gray-400 border-gray-700 bg-gray-900/20';

  return (
    <div
      className={`bg-[#1a2235] border rounded-xl p-4 transition-all ${
        selectable ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'border-[#e8451a] shadow-[0_0_0_1px_#e8451a]'
          : 'border-[#1e2d45] hover:border-[#e8451a]/50'
      }`}
      onClick={selectable ? onToggle : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="text-[#e8451a] text-xs font-mono font-bold">{lever.leverId}</span>
          <p className="text-white text-sm font-medium mt-0.5 leading-tight">{lever.title}</p>
        </div>
        {selectable && (
          <div className="flex-shrink-0 mt-0.5">
            {selected
              ? <CheckSquare className="w-5 h-5 text-[#e8451a]" />
              : <Square className="w-5 h-5 text-gray-500" />
            }
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs bg-[#0a0f1e] text-gray-400 rounded px-2 py-0.5">
          {lever.department}
        </span>
        <span className="text-xs bg-[#0a0f1e] text-gray-400 rounded px-2 py-0.5">
          {lever.improvementStructure}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-green-400 text-sm font-bold">
          {fmtSavings(lever.netSavingsEUR || 0)}
        </span>
        {lever.commitment && (
          <span className={`text-xs border rounded-full px-2 py-0.5 ${commitColor}`}>
            {lever.commitment}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Phase 2 — Lever Library ──────────────────────────────────────────────────

function Phase2Library({ levers }: { levers: Lever[] }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d45]">
        <h2 className="text-white text-xl font-bold">Bibliothèque de leviers</h2>
        <p className="text-gray-400 text-sm mt-1">{levers.length} levier(s) disponible(s) pour cette usine</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {levers.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <p className="text-lg">Aucun levier pour cette usine</p>
            <p className="text-sm mt-1">Les leviers seront disponibles ici une fois créés dans la page Leviers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {levers.map(lever => (
              <LeverCard key={lever.id} lever={lever} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 3 — Selection ─────────────────────────────────────────────────────

function Phase3Selection({
  levers,
  selections,
  projectId,
  plantId,
  onSelectionChange,
  onLeverAdded,
}: {
  levers: Lever[];
  selections: Record<string, WorkshopLeverSelection>;
  projectId: string;
  plantId: string;
  onSelectionChange: (leverId: string, selected: boolean) => void;
  onLeverAdded: (lever: Lever) => void;
}) {
  const [deptFilter, setDeptFilter] = useState('');
  const [structFilter, setStructFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const depts = [...new Set(levers.map(l => l.department).filter(Boolean))].sort();
  const structs = [...new Set(levers.map(l => l.improvementStructure).filter(Boolean))].sort();

  const filtered = levers.filter(l => {
    if (deptFilter && l.department !== deptFilter) return false;
    if (structFilter && l.improvementStructure !== structFilter) return false;
    return true;
  });

  const selectedCount = Object.values(selections).filter(s => s.selected).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d45] flex items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-white text-xl font-bold">Sélection collaborative</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            <span className="text-[#e8451a] font-bold">{selectedCount}</span> levier(s) sélectionné(s)
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-white text-xs focus:border-[#e8451a] outline-none"
          >
            <option value="">Tous les départements</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={structFilter}
            onChange={e => setStructFilter(e.target.value)}
            className="bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-white text-xs focus:border-[#e8451a] outline-none"
          >
            <option value="">Toutes les structures</option>
            {structs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 bg-[#e8451a] hover:bg-[#d03d16] text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau levier
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-16">Aucun levier ne correspond aux filtres</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(lever => (
              <LeverCard
                key={lever.id}
                lever={lever}
                selectable
                selected={!!selections[lever.id]?.selected}
                onToggle={() => onSelectionChange(lever.id, !selections[lever.id]?.selected)}
              />
            ))}
          </div>
        )}
      </div>

      {drawerOpen && (
        <AddLeverDrawer
          projectId={projectId}
          plantId={plantId}
          onClose={() => setDrawerOpen(false)}
          onCreated={(lever) => {
            onLeverAdded(lever);
            setDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Phase 4 — Scoring ───────────────────────────────────────────────────────

function Phase4Scoring({
  levers,
  selections,
  onUpdate,
}: {
  levers: Lever[];
  selections: Record<string, WorkshopLeverSelection>;
  onUpdate: (leverId: string, updates: Partial<WorkshopLeverSelection>) => void;
}) {
  const selected = levers.filter(l => selections[l.id]?.selected);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d45]">
        <h2 className="text-white text-xl font-bold">Scoring</h2>
        <p className="text-gray-400 text-sm mt-1">Évaluez les bénéfices et la faisabilité pour chaque levier sélectionné</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            Aucun levier sélectionné. Retournez à la phase Sélection.
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0a0f1e]">
              <tr className="text-left">
                <th className="px-6 py-3 text-xs text-gray-400 font-medium w-1/3">Levier</th>
                <th className="px-6 py-3 text-xs text-gray-400 font-medium">Département</th>
                <th className="px-6 py-3 text-xs text-gray-400 font-medium">Bénéfices (1–5)</th>
                <th className="px-6 py-3 text-xs text-gray-400 font-medium">Faisabilité (1–5)</th>
                <th className="px-6 py-3 text-xs text-gray-400 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d45]">
              {selected.map(lever => {
                const sel = selections[lever.id] || { benefits: 3, feasibility: 3 };
                const score = ((sel.benefits || 3) + (sel.feasibility || 3)) / 2;
                return (
                  <tr key={lever.id} className="hover:bg-[#1a2235]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-[#e8451a] text-xs font-mono">{lever.leverId}</div>
                      <div className="text-white text-sm font-medium mt-0.5">{lever.title}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{lever.department}</td>
                    <td className="px-6 py-4">
                      <ScoreDots
                        value={sel.benefits || 3}
                        onChange={v => onUpdate(lever.id, { benefits: v })}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <ScoreDots
                        value={sel.feasibility || 3}
                        onChange={v => onUpdate(lever.id, { feasibility: v })}
                        color="#22c55e"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${scoreColor(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Phase 5 — Commitment ────────────────────────────────────────────────────

function Phase5Commitment({
  levers,
  selections,
  onUpdate,
}: {
  levers: Lever[];
  selections: Record<string, WorkshopLeverSelection>;
  onUpdate: (leverId: string, updates: Partial<WorkshopLeverSelection>) => void;
}) {
  const selected = levers.filter(l => selections[l.id]?.selected);

  const counts = selected.reduce(
    (acc, l) => {
      const c = selections[l.id]?.commitment;
      if (c === 'Commitment') acc.commitment++;
      else if (c === 'Additional Potential') acc.additional++;
      else if (c === 'No Go') acc.nogo++;
      return acc;
    },
    { commitment: 0, additional: 0, nogo: 0 }
  );

  // Auto-set default commitment based on score
  useEffect(() => {
    selected.forEach(lever => {
      const sel = selections[lever.id];
      if (sel && !sel.commitment) {
        const score = ((sel.benefits || 3) + (sel.feasibility || 3)) / 2;
        onUpdate(lever.id, { commitment: defaultCommitment(score) });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d45] flex items-center gap-8">
        <div>
          <h2 className="text-white text-xl font-bold">Décision Commitment</h2>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span><span className="text-green-400 font-bold">{counts.commitment}</span> <span className="text-gray-400">Commitment</span></span>
          <span><span className="text-blue-400 font-bold">{counts.additional}</span> <span className="text-gray-400">Additional</span></span>
          <span><span className="text-red-400 font-bold">{counts.nogo}</span> <span className="text-gray-400">No Go</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#1e2d45]">
        {selected.length === 0 ? (
          <div className="text-center text-gray-500 py-16">Aucun levier sélectionné.</div>
        ) : selected.map(lever => {
          const sel = selections[lever.id] || { benefits: 3, feasibility: 3 };
          const score = ((sel.benefits || 3) + (sel.feasibility || 3)) / 2;
          const commitment = sel.commitment || defaultCommitment(score);

          return (
            <div key={lever.id} className="px-6 py-4 hover:bg-[#1a2235]/30 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#e8451a] text-xs font-mono">{lever.leverId}</span>
                    <span className={`text-xs font-bold ${scoreColor(score)}`}>Score: {score.toFixed(1)}</span>
                  </div>
                  <p className="text-white text-sm font-medium mt-0.5">{lever.title}</p>
                  <p className="text-gray-500 text-xs">{lever.department}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(['Commitment', 'Additional Potential', 'No Go'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => onUpdate(lever.id, { commitment: opt })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                        commitment === opt
                          ? opt === 'Commitment'
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : opt === 'Additional Potential'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                              : 'bg-red-500/20 border-red-500 text-red-400'
                          : 'bg-transparent border-[#1e2d45] text-gray-500 hover:border-gray-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <input
                  value={sel.comment || ''}
                  onChange={e => onUpdate(lever.id, { comment: e.target.value })}
                  placeholder="Commentaire..."
                  className="w-full md:w-48 bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-white text-xs focus:border-[#e8451a] outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Phase 6 — Synthesis ─────────────────────────────────────────────────────

function Phase6Synthesis({
  workshop,
  levers,
  selections,
  onApply,
  onClose,
}: {
  workshop: Workshop;
  levers: Lever[];
  selections: Record<string, WorkshopLeverSelection>;
  onApply: () => Promise<void>;
  onClose: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selected = levers.filter(l => selections[l.id]?.selected);

  const kpis = selected.reduce(
    (acc, l) => {
      const sel = selections[l.id];
      const c = sel?.commitment;
      acc.total++;
      if (c === 'Commitment') {
        acc.commitment++;
        acc.savings += l.netSavingsEUR || 0;
      } else if (c === 'Additional Potential') acc.additional++;
      else if (c === 'No Go') acc.nogo++;
      return acc;
    },
    { total: 0, commitment: 0, additional: 0, nogo: 0, savings: 0 }
  );

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply();
      toast.success('Leviers mis à jour et workshop clôturé');
    } catch {
      toast.error('Erreur lors de l\'application des modifications');
    } finally {
      setApplying(false);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Workshop Summary
      const summaryData = [
        ['Workshop', workshop.name],
        ['Date', workshop.date],
        ['Facilitateur', workshop.facilitator],
        ['Participants', workshop.participants.join(', ')],
        ['Statut', workshop.status],
        [],
        ['KPI', 'Valeur'],
        ['Total leviers sélectionnés', kpis.total],
        ['Commitment', kpis.commitment],
        ['Additional Potential', kpis.additional],
        ['No Go', kpis.nogo],
        ['Net Savings Commitment (€)', kpis.savings],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Workshop Summary');

      // Sheet 2 — Levers Updated
      const headers = ['ID', 'Titre', 'Département', 'Bénéfices', 'Faisabilité', 'Score', 'Décision', 'Commentaire'];
      const rows = selected.map(l => {
        const sel = selections[l.id];
        const score = ((sel?.benefits || 3) + (sel?.feasibility || 3)) / 2;
        return [
          l.leverId, l.title, l.department,
          sel?.benefits || 3, sel?.feasibility || 3,
          score.toFixed(1), sel?.commitment || '', sel?.comment || '',
        ];
      });
      const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Levers Updated');

      XLSX.writeFile(wb, `workshop_${workshop.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d45]">
        <h2 className="text-white text-xl font-bold">Synthèse et clôture</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Leviers sélectionnés', value: kpis.total, color: 'text-white' },
            { label: 'Commitment', value: kpis.commitment, color: 'text-green-400' },
            { label: 'Additional Potential', value: kpis.additional, color: 'text-blue-400' },
            { label: 'No Go', value: kpis.nogo, color: 'text-red-400' },
            { label: 'Net Savings Commitment', value: fmtSavings(kpis.savings), color: 'text-green-400' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[#1a2235] border border-[#1e2d45] rounded-xl p-4">
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-gray-400 text-xs mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#1a2235] border border-[#1e2d45] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0f1e]">
              <tr>
                {['ID', 'Titre', 'Département', 'Bénéfices', 'Faisabilité', 'Score', 'Décision', 'Commentaire'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d45]">
              {selected.map(lever => {
                const sel = selections[lever.id];
                const score = ((sel?.benefits || 3) + (sel?.feasibility || 3)) / 2;
                const commitColor = sel?.commitment === 'Commitment'
                  ? 'text-green-400'
                  : sel?.commitment === 'Additional Potential'
                    ? 'text-blue-400'
                    : 'text-red-400';
                return (
                  <tr key={lever.id} className="hover:bg-[#0a0f1e]/50">
                    <td className="px-4 py-3 text-[#e8451a] font-mono text-xs">{lever.leverId}</td>
                    <td className="px-4 py-3 text-white">{lever.title}</td>
                    <td className="px-4 py-3 text-gray-400">{lever.department}</td>
                    <td className="px-4 py-3 text-center">{sel?.benefits || 3}</td>
                    <td className="px-4 py-3 text-center">{sel?.feasibility || 3}</td>
                    <td className={`px-4 py-3 text-center font-bold ${scoreColor(score)}`}>{score.toFixed(1)}</td>
                    <td className={`px-4 py-3 font-medium ${commitColor}`}>{sel?.commitment || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{sel?.comment || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap pb-4">
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex items-center gap-2 bg-[#e8451a] hover:bg-[#d03d16] disabled:opacity-50 text-white rounded-xl px-5 py-2.5 font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            {applying ? 'Application...' : 'Appliquer au projet'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#1e2d45] hover:bg-[#2a3d55] disabled:opacity-50 text-white rounded-xl px-5 py-2.5 font-medium transition-colors"
          >
            {exporting ? 'Export...' : 'Exporter en Excel'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-transparent border border-[#1e2d45] hover:border-gray-500 text-gray-300 rounded-xl px-5 py-2.5 font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkshopCoConstruction() {
  const { activeWorkshopId, closeCoConstruction } = useWorkshopStore();
  const { selectedProjectId } = useProjectStore();
  const { plants } = usePlants(selectedProjectId);
  const { projects } = useProjects();
  const { workshops, createWorkshop, updateWorkshop, saveWorkshopSelections } = useWorkshops(selectedProjectId);

  const project = projects.find(p => p.id === selectedProjectId);

  // Active workshop state
  const [activeWorkshop, setActiveWorkshop] = useState<Workshop | null>(null);
  const [currentPhase, setCurrentPhase] = useState<WorkshopPhase>('setup');
  const [selections, setSelections] = useState<Record<string, WorkshopLeverSelection>>({});
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');

  // Load existing workshop if resuming
  useEffect(() => {
    if (activeWorkshopId) {
      const ws = workshops.find(w => w.id === activeWorkshopId);
      if (ws) {
        setActiveWorkshop(ws);
        setCurrentPhase(ws.currentPhase);
        setSelections(ws.leverSelections || {});
      }
    }
  }, [activeWorkshopId, workshops]);

  // Levers for the active workshop's plant
  const plantId = activeWorkshop?.plantId || '';
  const { levers: allLevers } = useLevers(selectedProjectId);
  const levers = allLevers.filter(l => !plantId || l.plantId === plantId);

  // ── Selection handlers ───────────────────────────────────────────────────

  const handleSelectionChange = useCallback(async (leverId: string, selected: boolean) => {
    setSelections(prev => {
      const existing = prev[leverId] || {
        leverId, selected: false, benefits: 3, feasibility: 3,
        commitment: 'Commitment' as const, comment: '', addedDuringWorkshop: false,
      };
      return { ...prev, [leverId]: { ...existing, selected } };
    });
  }, []);

  const handleUpdateSelection = useCallback((leverId: string, updates: Partial<WorkshopLeverSelection>) => {
    setSelections(prev => {
      const existing = prev[leverId] || {
        leverId, selected: true, benefits: 3, feasibility: 3,
        commitment: 'Commitment' as const, comment: '', addedDuringWorkshop: false,
      };
      return { ...prev, [leverId]: { ...existing, ...updates } };
    });
  }, []);

  const handleLeverAdded = useCallback((lever: Lever) => {
    setSelections(prev => ({
      ...prev,
      [lever.id]: {
        leverId: lever.id,
        selected: true,
        benefits: 3, feasibility: 3,
        commitment: 'Commitment',
        comment: '',
        addedDuringWorkshop: true,
      },
    }));
  }, []);

  // ── Phase navigation ─────────────────────────────────────────────────────

  const canGoNext = currentPhase !== 'setup'; // setup has its own submit button
  const canGoPrev = currentPhase !== 'setup' && currentPhase !== 'lever_library';
  const isLastPhase = currentPhase === 'synthesis';

  const persistAndNavigate = useCallback(async (phase: WorkshopPhase, dir: 'left' | 'right') => {
    if (!activeWorkshop) return;
    // Save selections + phase to Firestore
    await saveWorkshopSelections(activeWorkshop.id, selections);
    await updateWorkshop(activeWorkshop.id, { currentPhase: phase });
    setSlideDir(dir);
    setCurrentPhase(phase);
    setActiveWorkshop(prev => prev ? { ...prev, currentPhase: phase } : prev);
  }, [activeWorkshop, selections, saveWorkshopSelections, updateWorkshop]);

  const goNext = useCallback(async () => {
    const next = nextPhase(currentPhase);
    if (next) await persistAndNavigate(next, 'right');
  }, [currentPhase, persistAndNavigate]);

  const goPrev = useCallback(async () => {
    const prev = prevPhase(currentPhase);
    if (prev) await persistAndNavigate(prev, 'left');
  }, [currentPhase, persistAndNavigate]);

  // ── Apply to project ─────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!activeWorkshop) return;
    const selected = Object.values(selections).filter(s => s.selected);
    // Update each lever individually (no batch > 500)
    for (const sel of selected) {
      const lever = allLevers.find(l => l.id === sel.leverId);
      if (!lever) continue;
      await updateDoc(doc(db, 'levers', sel.leverId), {
        benefits: sel.benefits,
        feasibility: sel.feasibility,
        commitment: sel.commitment,
        comment: sel.comment,
      });
    }
    await updateWorkshop(activeWorkshop.id, { status: 'completed' });
    setActiveWorkshop(prev => prev ? { ...prev, status: 'completed' } : prev);
    closeCoConstruction();
  }, [activeWorkshop, selections, allLevers, updateWorkshop, closeCoConstruction]);

  // ── Quit handler ─────────────────────────────────────────────────────────

  const handleQuit = () => {
    if (currentPhase === 'synthesis') {
      closeCoConstruction();
    } else {
      setShowQuitConfirm(true);
    }
  };

  const confirmQuit = async () => {
    if (activeWorkshop) {
      await saveWorkshopSelections(activeWorkshop.id, selections);
    }
    setShowQuitConfirm(false);
    closeCoConstruction();
  };

  // ── Phase content ────────────────────────────────────────────────────────

  const phaseContent = () => {
    if (currentPhase === 'setup') {
      return (
        <Phase1Setup
          projectId={selectedProjectId!}
          plants={plants}
          existingWorkshop={activeWorkshop}
          onWorkshopCreated={(ws) => {
            setActiveWorkshop(ws);
            setCurrentPhase('lever_library');
          }}
        />
      );
    }
    if (!activeWorkshop) return null;

    switch (currentPhase) {
      case 'lever_library':
        return <Phase2Library levers={levers} />;
      case 'selection':
        return (
          <Phase3Selection
            levers={levers}
            selections={selections}
            projectId={selectedProjectId!}
            plantId={plantId}
            onSelectionChange={handleSelectionChange}
            onLeverAdded={handleLeverAdded}
          />
        );
      case 'scoring':
        return (
          <Phase4Scoring
            levers={levers}
            selections={selections}
            onUpdate={handleUpdateSelection}
          />
        );
      case 'commitment':
        return (
          <Phase5Commitment
            levers={levers}
            selections={selections}
            onUpdate={handleUpdateSelection}
          />
        );
      case 'synthesis':
        return (
          <Phase6Synthesis
            workshop={activeWorkshop}
            levers={levers}
            selections={selections}
            onApply={handleApply}
            onClose={closeCoConstruction}
          />
        );
      default:
        return null;
    }
  };

  const workshopName = activeWorkshop?.name || (project ? `Nouveau workshop — ${project.name}` : 'Nouveau workshop');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0f1e]">
      {/* ── Header ── */}
      <div className="flex-shrink-0 h-16 bg-[#111827] border-b border-[#1e2d45] flex items-center px-6 gap-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          <span className="text-[#e8451a] font-bold text-lg tracking-tight">BearingPoint</span>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-white font-semibold text-sm truncate">{workshopName}</h1>
        </div>

        {/* Phase indicator */}
        <div className="flex-shrink-0">
          <PhaseIndicator current={currentPhase} />
        </div>

        {/* Quit */}
        <button
          onClick={handleQuit}
          className="flex-shrink-0 flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-600/40 text-red-400 rounded-lg px-3 py-1.5 text-sm transition-colors"
        >
          <X className="w-4 h-4" /> Quitter
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPhase}
            className="h-full"
            initial={{ x: slideDir === 'right' ? 60 : -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: slideDir === 'right' ? -60 : 60, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {phaseContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer (hidden for setup phase which has its own button) ── */}
      {currentPhase !== 'setup' && (
        <div className="flex-shrink-0 h-16 bg-[#111827] border-t border-[#1e2d45] flex items-center justify-between px-6">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className="flex items-center gap-2 disabled:opacity-30 text-gray-300 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Phase précédente
          </button>

          {/* Phase label */}
          <span className="text-gray-500 text-xs">
            Phase {phaseIndex(currentPhase) + 1} — {PHASES[phaseIndex(currentPhase)].label}
          </span>

          {!isLastPhase ? (
            <button
              onClick={goNext}
              className="flex items-center gap-2 bg-[#e8451a] hover:bg-[#d03d16] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Phase suivante
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div /> // synthesis has its own buttons
          )}
        </div>
      )}

      {/* ── Quit confirm modal ── */}
      {showQuitConfirm && (
        <QuitConfirmModal
          onConfirm={confirmQuit}
          onCancel={() => setShowQuitConfirm(false)}
        />
      )}
    </div>
  );
}
