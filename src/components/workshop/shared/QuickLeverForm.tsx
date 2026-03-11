import React, { useState, useRef, useEffect } from 'react';
import { Plus, Lock } from 'lucide-react';
import type { WorkshopNewLever, WorkshopParticipant } from '../../../types/workshop';
import { IMPROVEMENT_STRUCTURES, LEVER_TYPES, DEPARTMENTS_LEVER } from '../../../types/lever';
import type { Plant } from '../../../types/project';

type FormData = {
  title: string;
  plantId: string;
  department: string;
  improvementStructure: string;
  leverType: string;
  estimatedAnnualSavings: string;
  estimatedCapex: string;
  commitment: 'Commitment' | 'Additional Potential';
  owner: string;
  horizon: 'short' | 'medium' | 'long' | '';
  effort: 'easy' | 'medium' | 'complex' | '';
  targetQuarter: string;
  context: string;
  consultantNote: string;
};

const DEFAULT_FORM: FormData = {
  title: '',
  plantId: '',
  department: '',
  improvementStructure: '',
  leverType: '',
  estimatedAnnualSavings: '',
  estimatedCapex: '',
  commitment: 'Commitment',
  owner: '',
  horizon: '',
  effort: '',
  targetQuarter: '',
  context: '',
  consultantNote: '',
};

interface QuickLeverFormProps {
  plants: Plant[];
  participants: WorkshopParticipant[];
  projectYears: number[];
  onSubmit: (data: Omit<WorkshopNewLever, 'id' | 'workshopId' | 'createdAt' | 'savedToLibrary' | 'savedToProject'>) => void;
}

export function QuickLeverForm({ plants, participants, projectYears, onSubmit }: QuickLeverFormProps) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLInputElement>(null);

  const quarterOptions = projectYears.flatMap(y => [1, 2, 3, 4].map(q => `Q${q} ${y}`));
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-white";

  const set = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(p => ({ ...p, [key]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Requis';
    if (!form.plantId) errs.plantId = 'Requis';
    if (!form.department) errs.department = 'Requis';
    if (!form.improvementStructure) errs.improvementStructure = 'Requis';
    if (!form.estimatedAnnualSavings || isNaN(+form.estimatedAnnualSavings)) errs.estimatedAnnualSavings = 'Requis';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      title: form.title.trim(),
      plantId: form.plantId,
      department: form.department,
      improvementStructure: form.improvementStructure,
      leverType: form.leverType,
      estimatedAnnualSavings: +form.estimatedAnnualSavings * 1000,
      estimatedCapex: form.estimatedCapex ? +form.estimatedCapex * 1000 : 0,
      commitment: form.commitment,
      owner: form.owner,
      horizon: (form.horizon || null) as 'short' | 'medium' | 'long' | null,
      effort: (form.effort || null) as 'easy' | 'medium' | 'complex' | null,
      targetQuarter: form.targetQuarter,
      context: form.context.trim(),
      consultantNote: form.consultantNote.trim(),
      source: 'On-site Workshop',
      createdInPhase: 3,
    });
    setForm(DEFAULT_FORM);
    setErrors({});
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  // Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [form]);

  const errCls = (k: string) => errors[k] ? 'border-red-400' : '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-gray-800 text-sm">Nouveau levier terrain</h3>

      {/* Block 1 — Identification */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Identification</div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Titre du levier *</label>
          <input
            ref={titleRef}
            value={form.title}
            onChange={set('title')}
            className={`${inputCls} text-base ${errCls('title')}`}
            placeholder="ex. Réduction temps changement de format ligne 3"
          />
          {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Usine *</label>
            <select value={form.plantId} onChange={set('plantId')} className={`${inputCls} ${errCls('plantId')}`}>
              <option value="">— Sélectionner —</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.plantId && <p className="text-xs text-red-500 mt-0.5">{errors.plantId}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Département *</label>
            <select value={form.department} onChange={set('department')} className={`${inputCls} ${errCls('department')}`}>
              <option value="">— Sélectionner —</option>
              {DEPARTMENTS_LEVER.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.department && <p className="text-xs text-red-500 mt-0.5">{errors.department}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Structure d'amélioration *</label>
            <select value={form.improvementStructure} onChange={set('improvementStructure')} className={`${inputCls} ${errCls('improvementStructure')}`}>
              <option value="">— Sélectionner —</option>
              {IMPROVEMENT_STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.improvementStructure && <p className="text-xs text-red-500 mt-0.5">{errors.improvementStructure}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Type de levier</label>
            <select value={form.leverType} onChange={set('leverType')} className={inputCls}>
              <option value="">— Optionnel —</option>
              {LEVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Block 2 — Financiers & Plan */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Financiers & Plan</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Savings estimés (k€/an) *</label>
            <input
              type="number"
              value={form.estimatedAnnualSavings}
              onChange={set('estimatedAnnualSavings')}
              className={`${inputCls} ${errCls('estimatedAnnualSavings')}`}
              placeholder="ex. 80"
              min="0"
            />
            {errors.estimatedAnnualSavings && <p className="text-xs text-red-500 mt-0.5">{errors.estimatedAnnualSavings}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">CAPEX estimé (k€)</label>
            <input
              type="number"
              value={form.estimatedCapex}
              onChange={set('estimatedCapex')}
              className={inputCls}
              placeholder="ex. 0"
              min="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Commitment *</label>
            <select value={form.commitment} onChange={set('commitment')} className={inputCls}>
              <option value="Commitment">Commitment</option>
              <option value="Additional Potential">Additional Potential</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Owner</label>
            <input
              value={form.owner}
              onChange={set('owner')}
              className={inputCls}
              placeholder="Nom de l'owner"
              list="qlf-owner-list"
            />
            <datalist id="qlf-owner-list">
              {participants.map((p, idx) => <option key={idx} value={p.name} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Horizon</label>
          <div className="flex gap-2">
            {(['short', 'medium', 'long'] as const).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setForm(p => ({ ...p, horizon: p.horizon === h ? '' : h }))}
                className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                  form.horizon === h
                    ? 'bg-bp-primary text-white border-bp-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
                }`}
              >
                {h === 'short' ? '<6m' : h === 'medium' ? '6-18m' : '>18m'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Effort</label>
          <div className="flex gap-2">
            {(['easy', 'medium', 'complex'] as const).map(ef => (
              <button
                key={ef}
                type="button"
                onClick={() => setForm(p => ({ ...p, effort: p.effort === ef ? '' : ef }))}
                className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                  form.effort === ef
                    ? 'bg-bp-primary text-white border-bp-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
                }`}
              >
                {ef === 'easy' ? 'Facile' : ef === 'medium' ? 'Moyen' : 'Complexe'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Quarter cible</label>
          <select value={form.targetQuarter} onChange={set('targetQuarter')} className={inputCls}>
            <option value="">— Sélectionner —</option>
            {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      {/* Block 3 — Contexte */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contexte</div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Contexte / Pourquoi ce levier ?</label>
          <textarea
            value={form.context}
            onChange={set('context')}
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Pourquoi ce levier a émergé en atelier..."
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
            <Lock size={11} /> Note consultant (confidentielle)
          </label>
          <textarea
            value={form.consultantNote}
            onChange={set('consultantNote')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-amber-50/40 resize-none"
            rows={2}
            placeholder="Note interne..."
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full py-3 bg-[#003057] text-white font-semibold rounded-xl hover:bg-[#003057]/90 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Plus size={16} /> Créer ce levier
        <span className="text-white/50 text-xs ml-2">Ctrl+Enter</span>
      </button>
    </div>
  );
}
