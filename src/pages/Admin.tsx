import React, { useState } from 'react';
import { Plus, Trash2, Building2, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Modal } from '../components/ui/Modal';
import { useProjectStore } from '../store/projectStore';
import { useProjects, usePlants } from '../hooks/useProjects';
import type { Project, Plant } from '../types/project';

function ProjectForm({ onSubmit, onCancel }: { onSubmit: (data: Omit<Project, 'id' | 'createdAt'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('BearingPoint');
  const [currency, setCurrency] = useState('EUR');
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";

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
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Annuler</button>
        <button onClick={() => name && onSubmit({ name, client, currency, years: [2024, 2025, 2026, 2027, 2028] })} className="btn-primary flex-1">
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

export function AdminPage() {
  const { selectedProjectId, setSelectedProject } = useProjectStore();
  const { projects, createProject, deleteProject } = useProjects();
  const { plants, createPlant, deletePlant } = usePlants(selectedProjectId);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [plantModalOpen, setPlantModalOpen] = useState(false);

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
    if (!confirm('Supprimer ce projet ? Cette action est irréversible.')) return;
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
                <th className="px-6 py-3 w-20" />
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
                  <td className="px-6 py-3 text-right">
                    <button onClick={e => { e.stopPropagation(); handleDeleteProject(project.id); }}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Aucun projet. Créez votre premier projet.</td></tr>
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
    </PageWrapper>
  );
}
