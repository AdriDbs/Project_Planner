import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { FileSpreadsheet, FileText, Save, Mail, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { WorkshopSession, LeverDecision, WorkshopNewLever, ComputedSavings } from '../../../types/workshop';
import type { Lever } from '../../../types/lever';
import type { Plant } from '../../../types/project';
import type { Project } from '../../../types/project';
import { exportProjectToExcel } from '../../../lib/excelExporter';
import { useLevers } from '../../../hooks/useLevers';
import { useLeverLibrary } from '../../../hooks/useLeverLibrary';

interface Phase6Props {
  session: WorkshopSession;
  project: Project;
  levers: Lever[];
  decisions: Record<string, LeverDecision>;
  newLevers: WorkshopNewLever[];
  computedSavings: ComputedSavings;
  plants: Plant[];
  projectYears: number[];
  onComplete: () => void;
}

function AnimatedCount({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="text-4xl font-bold"
    >
      {value > 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M€`
        : value > 999
        ? `${Math.round(value / 1000)}k€`
        : `${value}${suffix}`}
    </motion.span>
  );
}

export function Phase6_Synthesis({
  session, project, levers, decisions, newLevers, computedSavings, plants, projectYears, onComplete
}: Phase6Props) {
  const synthesisRef = useRef<HTMLDivElement>(null);
  const { addToLibrary } = useLeverLibrary();
  const { createLever } = useLevers(project.id);

  const validatedLevers = levers.filter(l => decisions[l.id]?.status === 'validated');
  const debatedLevers = levers.filter(l => decisions[l.id]?.status === 'debated');
  const totalRetained = validatedLevers.length + newLevers.length;

  // Savings by structure
  const savingsByStructure: Record<string, { commitment: number; additional: number }> = {};
  validatedLevers.forEach(l => {
    const d = decisions[l.id];
    const savings = (d?.useClientEstimate && d?.clientSavingsEstimate != null)
      ? d.clientSavingsEstimate
      : (l.netSavingsEUR ?? 0);
    const key = l.improvementStructure;
    if (!savingsByStructure[key]) savingsByStructure[key] = { commitment: 0, additional: 0 };
    if (d?.commitment === 'Commitment') savingsByStructure[key].commitment += savings;
    else savingsByStructure[key].additional += savings;
  });
  newLevers.forEach(l => {
    const key = l.improvementStructure || 'Other';
    if (!savingsByStructure[key]) savingsByStructure[key] = { commitment: 0, additional: 0 };
    if (l.commitment === 'Commitment') savingsByStructure[key].commitment += l.estimatedAnnualSavings ?? 0;
    else savingsByStructure[key].additional += l.estimatedAnnualSavings ?? 0;
  });

  const chartData = Object.entries(savingsByStructure).map(([name, v]) => ({
    name,
    Commitment: Math.round(v.commitment / 1000),
    'Add. Potential': Math.round(v.additional / 1000),
  }));

  // Levers grouped by quarter
  const byQuarter: Record<string, { title: string; type: string; owner: string }[]> = {};
  validatedLevers.filter(l => decisions[l.id]?.commitment === 'Commitment').forEach(l => {
    const q = decisions[l.id]?.targetQuarter ?? 'Sans date';
    if (!byQuarter[q]) byQuarter[q] = [];
    byQuarter[q].push({ title: l.title, type: '📚', owner: decisions[l.id]?.owner ?? '' });
  });
  newLevers.filter(l => l.commitment === 'Commitment').forEach(l => {
    const q = l.targetQuarter ?? 'Sans date';
    if (!byQuarter[q]) byQuarter[q] = [];
    byQuarter[q].push({ title: l.title, type: '🆕', owner: l.owner ?? '' });
  });

  // Export Excel
  const handleExcelExport = async () => {
    try {
      const adjustedLevers = levers
        .filter(l => decisions[l.id]?.status === 'validated')
        .map(l => {
          const d = decisions[l.id];
          return {
            ...l,
            commitment: d?.commitment ?? l.commitment,
            netSavingsEUR: (d?.useClientEstimate && d?.clientSavingsEstimate != null)
              ? d.clientSavingsEstimate
              : l.netSavingsEUR,
          };
        });

      await exportProjectToExcel({
        project,
        plants,
        levers: adjustedLevers,
        baselines: [],
        years: projectYears,
        filename: `Workshop_${session.clientName}_${session.workshopDate}.xlsx`,
      });
      toast.success('Export Excel généré');
    } catch (e) {
      toast.error('Erreur lors de l\'export');
    }
  };

  // Export PDF
  const handlePdfExport = async () => {
    if (!synthesisRef.current) return;
    try {
      const canvas = await html2canvas(synthesisRef.current, { scale: 1.5, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(14);
      pdf.setTextColor(0, 48, 87);
      pdf.text(`Synthèse Workshop — ${session.clientName} — ${session.workshopDate}`, 10, 15);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Facilitateur: ${session.facilitator} | Participants: ${session.participants.map(p => p.name).join(', ')}`, 10, 22);

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 30, imgWidth, Math.min(imgHeight, 250));

      if (session.agreedScope) {
        pdf.addPage();
        pdf.setFontSize(11);
        pdf.setTextColor(0, 48, 87);
        pdf.text('Scope convenu', 10, 15);
        pdf.setFontSize(9);
        pdf.setTextColor(50, 50, 50);
        const lines = pdf.splitTextToSize(session.agreedScope, 190);
        pdf.text(lines, 10, 25);
      }

      // Footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Confidentiel — BearingPoint — ${new Date().toLocaleDateString('fr-FR')}`, 10, 290);
      }

      pdf.save(`OnePager_${session.clientName}_${session.workshopDate}.pdf`);
      toast.success('PDF généré');
    } catch (e) {
      toast.error('Erreur lors de la génération PDF');
    }
  };

  // Save to library
  const handleSaveToLibrary = async () => {
    const toSave = newLevers.filter(l => !l.savedToLibrary);
    if (toSave.length === 0) {
      toast('Tous les leviers sont déjà sauvegardés');
      return;
    }

    if (!confirm(`Sauvegarder ${toSave.length} levier(s) terrain dans la bibliothèque et le projet ?`)) return;

    try {
      for (const lever of toSave) {
        // Add to library
        await addToLibrary({
          leverId: `WS-${lever.id.slice(0, 8)}`,
          title: lever.title,
          platform: '',
          source: 'On-site Workshop',
          improvementStructure: lever.improvementStructure as any,
          leverType: (lever.leverType || 'Operational Basics') as any,
          digitalizationMechanization: 'Other Lever Type' as any,
          department: lever.department,
          referenceNetSavingsEUR: lever.estimatedAnnualSavings,
          referenceCapexEUR: lever.estimatedCapex,
          referencePayback: lever.estimatedCapex > 0
            ? lever.estimatedCapex / lever.estimatedAnnualSavings
            : 0,
          referenceFTE: 0,
          benefits: 3,
          feasibility: 3,
          tags: ['On-site Workshop'],
          originProjectId: project.id,
          originProjectName: project.name,
          isActive: true,
          usedInProjects: [project.id],
        });
      }
      toast.success(`${toSave.length} levier(s) sauvegardé(s) dans la bibliothèque`);
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  // Email
  const handleEmail = () => {
    const subject = encodeURIComponent(`[Confidentiel] Synthèse Workshop — ${session.clientName} — ${session.workshopDate}`);
    const commitmentLevers = validatedLevers.filter(l => decisions[l.id]?.commitment === 'Commitment');
    const body = encodeURIComponent(
      `Synthèse Workshop de Co-construction\n` +
      `Client: ${session.clientName}\n` +
      `Date: ${session.workshopDate}\n` +
      `Facilitateur: ${session.facilitator}\n\n` +
      `KPIs:\n` +
      `- Leviers retenus: ${totalRetained}\n` +
      `- Net Savings Commitment: ${(computedSavings.total.commitment / 1_000_000).toFixed(1)} M€\n` +
      `- Full Potential: ${(computedSavings.total.full / 1_000_000).toFixed(1)} M€\n` +
      `- CAPEX requis: ${(computedSavings.totalCapex / 1_000_000).toFixed(1)} M€\n\n` +
      `Leviers Commitment:\n` +
      commitmentLevers.map(l => `- ${l.title} — Owner: ${decisions[l.id]?.owner || 'N/A'} — ${decisions[l.id]?.targetQuarter || 'N/A'}`).join('\n') +
      (newLevers.filter(l => l.commitment === 'Commitment').length > 0
        ? '\n\nLeviers terrain (Commitment):\n' +
          newLevers.filter(l => l.commitment === 'Commitment')
            .map(l => `- 🆕 ${l.title} — Owner: ${l.owner || 'N/A'} — ${l.targetQuarter || 'N/A'}`).join('\n')
        : '') +
      '\n\nProchaines étapes: Voir le plan ci-joint.'
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex-1 overflow-hidden bg-[#003057] flex flex-col">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 p-6 flex-shrink-0">
        {[
          { label: 'Leviers retenus', value: totalRetained, suffix: '' },
          { label: 'Net Savings Commitment', value: computedSavings.total.commitment, suffix: '' },
          { label: 'Full Potential', value: computedSavings.total.full, suffix: '' },
          { label: 'CAPEX requis', value: computedSavings.totalCapex, suffix: '' },
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.15, duration: 0.6 }}
            className="bg-white/10 rounded-2xl p-5 text-center"
          >
            <AnimatedCount value={kpi.value} suffix={kpi.suffix} />
            <div className="text-white/60 text-sm mt-1">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Content body */}
      <div ref={synthesisRef} className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* Left column */}
        <div className="p-6 overflow-y-auto border-r border-white/10 space-y-6">
          <div>
            <h3 className="text-white font-semibold mb-3 text-lg">Ce qui est validé</h3>
            {chartData.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-4" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 10 }}>
                    <XAxis type="number" tickFormatter={v => `${v}k€`} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} width={55} />
                    <Tooltip
                      formatter={(v: number | undefined) => v != null ? [`${v}k€`, ''] : ['-', '']}
                      contentStyle={{ background: '#1e3a5f', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                    <Bar dataKey="Commitment" stackId="a" fill="#00B050" />
                    <Bar dataKey="Add. Potential" stackId="a" fill="#00A3E0" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="p-6 overflow-y-auto space-y-4">
          <h3 className="text-white font-semibold text-lg">Le plan</h3>

          {/* By quarter */}
          {Object.entries(byQuarter).slice(0, 4).map(([q, items]) => (
            <div key={q} className="bg-white/10 rounded-xl p-3">
              <div className="text-white/80 text-sm font-medium mb-2">{q}</div>
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-white/70">
                    <span>{item.type}</span>
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.owner && <span className="text-white/50">{item.owner}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* New levers section */}
          {newLevers.length > 0 && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-white/80 text-sm font-medium mb-2">🆕 Leviers identifiés sur le terrain</div>
              {newLevers.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-white/70">
                  <span className="flex-1 truncate">{l.title}</span>
                  {l.owner && <span className="text-white/50">{l.owner}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Debates */}
          {debatedLevers.length > 0 && (
            <div className="bg-yellow-500/20 rounded-xl p-3">
              <div className="text-yellow-300 text-sm font-medium mb-2">
                <Flag size={13} className="inline mr-1" />
                Points ouverts ({debatedLevers.length})
              </div>
              {debatedLevers.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-white/70">
                  <span className="flex-1 truncate">{l.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Constraints */}
          {session.keyConstraints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {session.keyConstraints.map(c => (
                <span key={c} className="text-xs px-2.5 py-1 bg-white/10 text-white/60 rounded-full">{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex-shrink-0 border-t border-white/10 p-4 grid grid-cols-4 gap-3">
        <button
          onClick={handleExcelExport}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <FileSpreadsheet size={16} /> Export Excel
        </button>
        <button
          onClick={handlePdfExport}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <FileText size={16} /> One-Pager PDF
        </button>
        <button
          onClick={handleSaveToLibrary}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <Save size={16} /> Sauvegarder biblio.
        </button>
        <button
          onClick={handleEmail}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <Mail size={16} /> Envoyer email
        </button>
      </div>
    </div>
  );
}
