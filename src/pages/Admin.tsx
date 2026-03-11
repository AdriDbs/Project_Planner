import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, FolderOpen, BookOpen, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Modal } from '../components/ui/Modal';
import { useProjectStore } from '../store/projectStore';
import { useProjects, usePlants } from '../hooks/useProjects';
import { useLeverLibrary } from '../hooks/useLeverLibrary';
import { migrateExistingLeversToLibrary } from '../lib/migrations';
import type { Project, Plant } from '../types/project';
import type { Lever } from '../types/lever';

function ProjectForm({ onSubmit, onCancel }: { onSubmit: (data: Omit<Project, 'id' | 'createdAt'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('BearingPoint');
  const [currency, setCurrency] = useState('EUR');
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + 4);
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";

  const yearOptions = Array.from({ length: currentYear - 2019 + 16 }, (_, i) => 2019 + i);

  const handleSubmit = () => {
    if (!name) return;
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    onSubmit({ name, client, currency, years });
  };

  return (
    <div className="space-y-4">
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Nom du projet *</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="ex. BBACM 2024" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
        <input value={client} onChange={e => setClient(e.target.value)} className={inputCls} /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls + ' bg-white'}>
          <option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option>
        </select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Année de début *</label>
          <select value={startYear} onChange={e => { const y = +e.target.value; setStartYear(y); if (y > endYear) setEndYear(y); }} className={inputCls + ' bg-white'}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Année de fin *</label>
          <select value={endYear} onChange={e => { const y = +e.target.value; setEndYear(y); if (y < startYear) setStartYear(y); }} className={inputCls + ' bg-white'}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select></div>
      </div>
      {startYear <= endYear && (
        <p className="text-xs text-gray-400">Années couvertes : {Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).join(', ')}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1">
          Créer le projet
        </button>
      </div>
    </div>
  );
}

function PlantForm({ projectId, onSubmit, onCancel }: { projectId: string; onSubmit: (data: Omit<Plant, 'id'>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', zone: '', currency: 'EUR', currencyRate: 1, platform: '' });
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
        <input value={form.code} onChange={set('code')} className={inputCls} placeholder="ex. 112" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
        <input value={form.name} onChange={set('name')} className={inputCls} placeholder="ex. Dole" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
        <input value={form.zone} onChange={set('zone')} className={inputCls} placeholder="ex. France" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Plateforme</label>
        <input value={form.platform} onChange={set('platform')} className={inputCls} placeholder="ex. Processed Cheese" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
        <input value={form.currency} onChange={set('currency')} className={inputCls} /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Taux de change</label>
        <input type="number" step="0.01" value={form.currencyRate} onChange={e => setForm(p => ({ ...p, currencyRate: +e.target.value }))} className={inputCls} /></div>
      <div className="col-span-2 flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Annuler</button>
        <button onClick={() => form.name && form.code && onSubmit({ ...form, projectId })} className="btn-primary flex-1">
          Ajouter l'usine
        </button>
      </div>
    </div>
  );
}

// ─── Modal export vers bibliothèque ────────────────────────────────────────────

interface ExportToLibraryModalProps {
  project: Project;
  onClose: () => void;
}

function ExportToLibraryModal({ project, onClose }: ExportToLibraryModalProps) {
  const [levers, setLevers] = useState<Lever[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { libraryLevers, importLeversFromProject } = useLeverLibrary();
  const [saving, setSaving] = useState(false);

  const libraryLeverIds = new Set(
    libraryLevers
      .filter(l => l.originProjectId === project.id)
      .map(l => l.leverId)
  );

  useEffect(() => {
    getDocs(query(collection(db, 'levers'), where('projectId', '==', project.id))).then(snap => {
      setLevers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lever)));
    });
  }, [project.id]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (!selectedIds.size) return;
    setSaving(true);
    try {
      await importLeversFromProject(project.id, project.name, [...selectedIds]);
      toast.success(`${selectedIds.size} levier(s) exportés vers la bibliothèque`);
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Sélectionnez les leviers à exporter vers la bibliothèque partagée.
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === levers.length && levers.length > 0}
                  onChange={() => {
                    if (selectedIds.size === levers.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(levers.map(l => l.id)));
                  }}
                  className="rounded"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Titre</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Statut biblio.</th>
            </tr>
          </thead>
          <tbody>
            {levers.map((lever, i) => {
              const inLibrary = libraryLeverIds.has(lever.leverId);
              return (
                <tr key={lever.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lever.id)}
                      onChange={() => toggle(lever.id)}
                      disabled={inLibrary}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-bp-primary">{lever.leverId}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{lever.title}</td>
                  <td className="px-3 py-2">
                    {inLibrary ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                        Déjà en bibliothèque
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {levers.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Aucun levier dans ce projet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-ghost flex-1">Annuler</button>
        <button onClick={handleExport} disabled={!selectedIds.size || saving} className="btn-primary flex-1">
          {saving ? 'Export...' : `Exporter la sélection (${selectedIds.size})`}
        </button>
      </div>
    </div>
  );
}

// ─── Page Admin principale ──────────────────────────────────────────────────────

export function AdminPage() {
  const { selectedProjectId, setSelectedProject } = useProjectStore();
  const { projects, createProject, deleteProject } = useProjects();
  const { plants, createPlant, deletePlant } = usePlants(selectedProjectId);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [plantModalOpen, setPlantModalOpen] = useState(false);
  const [exportModalProject, setExportModalProject] = useState<Project | null>(null);
  const [migratingProjectId, setMigratingProjectId] = useState<string | null>(null);

  // Compteurs de leviers par projet
  const [leverCounts, setLeverCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!projects.length) return;
    (async () => {
      const counts: Record<string, number> = {};
      for (const p of projects) {
        const snap = await getDocs(query(collection(db, 'levers'), where('projectId', '==', p.id)));
        counts[p.id] = snap.size;
      }
      setLeverCounts(counts);
    })();
  }, [projects]);

  const handleCreateProject = async (data: Omit<Project, 'id' | 'createdAt'>) => {
    try {
      const id = await createProject(data);
      setSelectedProject(id);
      setProjectModalOpen(false);
      toast.success('Projet créé avec succès');
    } catch {
      toast.error('Erreur lors de la création du projet');
    }
  };

  const handleCreatePlant = async (data: Omit<Plant, 'id'>) => {
    try {
      await createPlant(data);
      setPlantModalOpen(false);
      toast.success('Usine ajoutée avec succès');
    } catch {
      toast.error('Erreur lors de la création de l\'usine');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Supprimer ce projet supprimera définitivement tous ses leviers, baselines et usines associées. Cette action est irréversible.')) return;
    try {
      await deleteProject(id);
      if (selectedProjectId === id) setSelectedProject(null);
      toast.success('Projet supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeletePlant = async (id: string) => {
    if (!confirm('Supprimer cette usine ?')) return;
    try {
      await deletePlant(id);
      toast.success('Usine supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleMigrate = async (project: Project) => {
    if (!confirm(`Migrer tous les leviers de "${project.name}" vers la bibliothèque ?\nLes leviers déjà présents dans la bibliothèque seront ignorés.`)) return;
    setMigratingProjectId(project.id);
    try {
      const count = await migrateExistingLeversToLibrary(project.id, project.name);
      toast.success(`${count} levier(s) migré(s) vers la bibliothèque`);
    } catch (e) {
      toast.error(`Erreur lors de la migration : ${(e as Error).message}`);
    } finally {
      setMigratingProjectId(null);
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-6 max-w-5xl">
        {/* Projects */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen size={18} className="text-bp-primary" />
              <h3 className="font-semibold text-gray-800">Projets ({projects.length})</h3>
            </div>
            <button onClick={() => setProjectModalOpen(true)} className="btn-primary flex items-center gap-2 text-xs">
              <Plus size={13} /> Nouveau Projet
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Nom</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Devise</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Années</th>
                <th className="text-left px-6 py-3 font-medium text-gray-600">Leviers</th>
                <th className="px-6 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project, i) => (
                <tr key={project.id} className={`${selectedProjectId === project.id ? 'bg-bp-secondary/5 border-l-4 border-bp-secondary' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} cursor-pointer hover:bg-bp-secondary/10 transition-colors`}
                  onClick={() => setSelectedProject(project.id)}>
                  <td className="px-6 py-3 font-medium text-bp-primary">{project.name}</td>
                  <td className="px-6 py-3 text-gray-600">{project.client}</td>
                  <td className="px-6 py-3">{project.currency}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{project.years?.join(', ')}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-bp-primary/10 text-bp-primary text-xs font-medium">
                      {leverCounts[project.id] ?? '…'} levier{(leverCounts[project.id] ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setExportModalProject(project)}
                        title="Exporter vers la bibliothèque"
                        className="p-1.5 hover:bg-bp-secondary/10 rounded text-bp-secondary hover:text-bp-primary transition-colors flex items-center gap-1 text-xs"
                      >
                        <ArrowUpRight size={13} />
                        <span className="hidden sm:inline">Bibliothèque</span>
                      </button>
                      <button
                        onClick={() => handleMigrate(project)}
                        disabled={migratingProjectId === project.id}
                        title="Migrer tous les leviers vers la bibliothèque"
                        className="p-1.5 hover:bg-green-50 rounded text-gray-400 hover:text-green-700 transition-colors flex items-center gap-1 text-xs"
                      >
                        <BookOpen size={13} />
                        <span className="hidden sm:inline">
                          {migratingProjectId === project.id ? 'Migration...' : 'Migrer'}
                        </span>
                      </button>
                      <button onClick={() => handleDeleteProject(project.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Aucun projet. Créez votre premier projet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Plants */}
        {selectedProjectId && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-bp-primary" />
                <h3 className="font-semibold text-gray-800">Usines du projet sélectionné ({plants.length})</h3>
              </div>
              <button onClick={() => setPlantModalOpen(true)} className="btn-primary flex items-center gap-2 text-xs">
                <Plus size={13} /> Ajouter une Usine
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Code</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Nom</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Zone</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Plateforme</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Devise</th>
                  <th className="px-6 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {plants.map((plant, i) => (
                  <tr key={plant.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-6 py-3 font-mono text-xs font-semibold text-bp-primary">{plant.code}</td>
                    <td className="px-6 py-3 font-medium">{plant.name}</td>
                    <td className="px-6 py-3 text-gray-600">{plant.zone}</td>
                    <td className="px-6 py-3 text-gray-600">{plant.platform}</td>
                    <td className="px-6 py-3">{plant.currency} ({plant.currencyRate})</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDeletePlant(plant.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {plants.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Aucune usine configurée pour ce projet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Firebase config info */}
        <div className="card bg-bp-primary/5 border-bp-primary/20">
          <h3 className="font-semibold text-bp-primary mb-2">Configuration Firebase</h3>
          <p className="text-sm text-gray-600 mb-3">
            Pour connecter cette application à votre propre Firebase, créez un fichier <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code> avec les variables suivantes :
          </p>
          <pre className="bg-white rounded-lg p-4 text-xs text-gray-700 border border-gray-200 overflow-x-auto">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef`}
          </pre>
        </div>
      </div>

      <Modal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} title="Nouveau Projet" size="md">
        <ProjectForm onSubmit={handleCreateProject} onCancel={() => setProjectModalOpen(false)} />
      </Modal>

      {selectedProjectId && (
        <Modal isOpen={plantModalOpen} onClose={() => setPlantModalOpen(false)} title="Ajouter une Usine" size="md">
          <PlantForm projectId={selectedProjectId} onSubmit={handleCreatePlant} onCancel={() => setPlantModalOpen(false)} />
        </Modal>
      )}

      {exportModalProject && (
        <Modal
          isOpen={true}
          onClose={() => setExportModalProject(null)}
          title={`Exporter vers la bibliothèque — ${exportModalProject.name}`}
          size="lg"
        >
          <ExportToLibraryModal
            project={exportModalProject}
            onClose={() => setExportModalProject(null)}
          />
        </Modal>
      )}
    </PageWrapper>
  );
}
