import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { IMPROVEMENT_STRUCTURES, LEVER_TYPES, DEPARTMENTS_LEVER } from '../../types/lever';
import type { Lever } from '../../types/lever';
import { useProjectStore } from '../../store/projectStore';
import { usePlants } from '../../hooks/useProjects';

interface Props {
  projectId: string;
  onSubmit: (data: Omit<Lever, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<Lever>;
}

const STEPS = [
  { label: 'Identification', fields: ['leverId', 'platform', 'plantId', 'department', 'title', 'source'] },
  { label: 'Classification', fields: ['improvementStructure', 'leverType', 'digitalizationMechanization', 'inScope', 'inBudget'] },
  { label: 'Financiers', fields: ['savingsByYear', 'fyTotalSavingsLC', 'capexLC', 'netSavingsLC', 'fyTotalSavingsEUR', 'capexEUR', 'netSavingsEUR'] },
  { label: 'Évaluation', fields: ['benefits', 'feasibility', 'payback', 'commitment', 'comment'] },
  { label: 'FTE & KPIs', fields: ['fteSavingsType', 'fte', 'gy', 'oee', 'ht', 'rmLosses', 'pmLosses'] },
  { label: 'Planning', fields: ['implementationStart', 'implementationEnd', 'projectDurationMonths', 'capexImpactYear', 'kpiImpactYear'] },
];

export function LeverForm({ projectId, onSubmit, onCancel, initialData }: Props) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { selectedYears } = useProjectStore();
  const { plants } = usePlants(projectId);

  const { register, handleSubmit } = useForm<any>({
    defaultValues: {
      projectId,
      leverId: '',
      platform: '',
      plantId: '',
      department: 'Manufacturing',
      title: '',
      source: 'On-site Workshop',
      improvementStructure: 'DLC',
      leverType: 'Operational Basics',
      digitalizationMechanization: 'Other Lever Type',
      inBudget: false,
      inScope: true,
      commitment: 'Commitment',
      benefits: 3,
      feasibility: 3,
      payback: 0,
      comment: '',
      fteSavingsType: 'Not impacting',
      fte: 0,
      oeeOrFte: '',
      gy: [0, 0, 0],
      oee: [0, 0, 0],
      ht: [0, 0, 0],
      rmLosses: 0,
      pmLosses: 0,
      implementationStart: '',
      implementationEnd: '',
      projectDurationMonths: 0,
      capexImpactYear: '',
      kpiImpactYear: '',
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
      savingsByYear: Object.fromEntries(selectedYears.map(y => [String(y), 0])),
      ...initialData,
    },
  });

  const doSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary transition-colors";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const selectCls = `${inputCls} bg-white`;

  return (
    <form onSubmit={handleSubmit(doSubmit)} className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                i === step ? 'bg-bp-primary text-white' :
                i < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? <Check size={12} /> : <span>{i + 1}</span>}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Identification */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>ID Levier *</label>
            <input {...register('leverId', { required: true })} className={inputCls} placeholder="ex. MF29" />
          </div>
          <div>
            <label className={labelCls}>Plateforme</label>
            <input {...register('platform')} className={inputCls} placeholder="ex. Processed Cheese" />
          </div>
          <div>
            <label className={labelCls}>Usine</label>
            <select {...register('plantId')} className={selectCls}>
              <option value="">— Sélectionner —</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Département</label>
            <select {...register('department')} className={selectCls}>
              {DEPARTMENTS_LEVER.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Intitulé du Levier *</label>
            <input {...register('title', { required: true })} className={inputCls} placeholder="Description détaillée du levier" />
          </div>
          <div>
            <label className={labelCls}>Source</label>
            <select {...register('source')} className={selectCls}>
              <option>Result plan</option>
              <option>On-site Workshop</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Classification */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Structure d'Amélioration</label>
            <select {...register('improvementStructure')} className={selectCls}>
              {IMPROVEMENT_STRUCTURES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type de Levier</label>
            <select {...register('leverType')} className={selectCls}>
              {LEVER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Digitalisation / Mécanisation</label>
            <select {...register('digitalizationMechanization')} className={selectCls}>
              <option>Digitalization</option>
              <option>Mechanization</option>
              <option>Other Lever Type</option>
            </select>
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('inScope')} className="w-4 h-4 accent-bp-primary" />
              <span>In Scope</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('inBudget')} className="w-4 h-4 accent-bp-primary" />
              <span>In Budget</span>
            </label>
          </div>
        </div>
      )}

      {/* Step 3: Financiers */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Savings par Année</h4>
            <div className="grid grid-cols-5 gap-3">
              {selectedYears.map(year => (
                <div key={year}>
                  <label className={labelCls}>{year}</label>
                  <input
                    type="number"
                    {...register(`savingsByYear.${year}`)}
                    className={inputCls}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Devise Locale (LC)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>FY Total Savings (LC)</label><input type="number" {...register('fyTotalSavingsLC')} className={inputCls} /></div>
              <div><label className={labelCls}>CAPEX (LC)</label><input type="number" {...register('capexLC')} className={inputCls} /></div>
              <div><label className={labelCls}>Approved CAPEX (LC)</label><input type="number" {...register('approvedCapexLC')} className={inputCls} /></div>
              <div><label className={labelCls}>One-Off OPEX (LC)</label><input type="number" {...register('oneOffOpexLC')} className={inputCls} /></div>
              <div><label className={labelCls}>Recurring OPEX (LC)</label><input type="number" {...register('recurringOpexLC')} className={inputCls} /></div>
              <div><label className={labelCls}>Net Savings (LC)</label><input type="number" {...register('netSavingsLC')} className={inputCls} /></div>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Euros (€)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>FY Total Savings (€)</label><input type="number" {...register('fyTotalSavingsEUR')} className={inputCls} /></div>
              <div><label className={labelCls}>CAPEX (€)</label><input type="number" {...register('capexEUR')} className={inputCls} /></div>
              <div><label className={labelCls}>Approved CAPEX (€)</label><input type="number" {...register('approvedCapexEUR')} className={inputCls} /></div>
              <div><label className={labelCls}>One-Off OPEX (€)</label><input type="number" {...register('oneOffOpexEUR')} className={inputCls} /></div>
              <div><label className={labelCls}>Recurring OPEX (€)</label><input type="number" {...register('recurringOpexEUR')} className={inputCls} /></div>
              <div><label className={labelCls}>Net Savings (€)</label><input type="number" {...register('netSavingsEUR')} className={inputCls} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Évaluation */}
      {step === 3 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Benefits (1-5)</label>
            <input type="number" min={1} max={5} {...register('benefits')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Feasibility (1-5)</label>
            <input type="number" min={1} max={5} {...register('feasibility')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Payback (années)</label>
            <input type="number" step="0.1" {...register('payback')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Commitment</label>
            <select {...register('commitment')} className={selectCls}>
              <option>Commitment</option>
              <option>Additional Potential</option>
              <option>No Go</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Commentaire</label>
            <textarea {...register('comment')} className={`${inputCls} h-24 resize-none`} />
          </div>
        </div>
      )}

      {/* Step 5: FTE & KPIs */}
      {step === 4 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>FTE Savings Type</label>
            <select {...register('fteSavingsType')} className={selectCls}>
              <option>Hard</option>
              <option>Soft</option>
              <option>Not impacting</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Nombre de FTE</label>
            <input type="number" step="0.1" {...register('fte')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>RM Losses</label>
            <input type="number" {...register('rmLosses')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>PM Losses</label>
            <input type="number" {...register('pmLosses')} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>OEE or FTE</label>
            <input {...register('oeeOrFte')} className={inputCls} />
          </div>
          <div className="col-span-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GY / OEE / H/T (3 ans)</h4>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-2">
                  <p className="text-xs text-gray-500 text-center">Année {i + 1}</p>
                  <input type="number" {...register(`gy.${i}`)} placeholder={`GY${i + 1}`} className={inputCls} />
                  <input type="number" step="0.01" {...register(`oee.${i}`)} placeholder={`OEE${i + 1}`} className={inputCls} />
                  <input type="number" step="0.01" {...register(`ht.${i}`)} placeholder={`H/T${i + 1}`} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Planning */}
      {step === 5 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Date début implémentation</label>
            <input type="date" {...register('implementationStart')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date fin implémentation</label>
            <input type="date" {...register('implementationEnd')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Durée projet (mois)</label>
            <input type="number" {...register('projectDurationMonths')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CAPEX Impact Year</label>
            <input {...register('capexImpactYear')} className={inputCls} placeholder="2024" />
          </div>
          <div>
            <label className={labelCls}>KPI Impact Year</label>
            <input {...register('kpiImpactYear')} className={inputCls} placeholder="2024" />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
          className="btn-ghost flex items-center gap-2"
        >
          <ChevronLeft size={14} />
          {step === 0 ? 'Annuler' : 'Précédent'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="btn-primary flex items-center gap-2"
          >
            Suivant <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? 'Sauvegarde...' : <><Check size={14} /> Enregistrer</>}
          </button>
        )}
      </div>
    </form>
  );
}
