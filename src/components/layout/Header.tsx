import React from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Globe, ChevronDown } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { usePlants } from '../../hooks/useProjects';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard Exécutif',
  '/baseline': 'Baseline des Coûts',
  '/levers': 'Performance Levers',
  '/savings-by-type': 'Savings par Nature de Coût',
  '/phasing': 'Phasing des Savings',
  '/organization': 'Organisation & FTE',
  '/capex-opex': 'CAPEX & OPEX',
  '/out-of-scope': 'Out of Scope',
  '/export': 'Export Excel',
  '/workshop': 'Workshop Client',
  '/admin': 'Administration',
};

interface HeaderProps {
  saving?: boolean;
}

export function Header({ saving }: HeaderProps) {
  const { pathname } = useLocation();
  const { projects, selectedProjectId, setSelectedProject, locale, setLocale } = useProjectStore();
  const { plants } = usePlants(selectedProjectId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-bp-primary">{PAGE_TITLES[pathname] || 'Performance Levers'}</h1>
        {selectedProject && (
          <p className="text-sm text-gray-500">{selectedProject.name} · {plants.length} usines</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {saving && (
          <div className="flex items-center gap-2 text-bp-secondary text-sm">
            <Save size={14} className="animate-pulse" />
            <span>Sauvegarde...</span>
          </div>
        )}

        {/* Project selector */}
        <div className="relative">
          <select
            className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:border-bp-secondary cursor-pointer"
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
          >
            <option value="">Sélectionner un projet</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Locale toggle */}
        <button
          onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-bp-primary transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
        >
          <Globe size={14} />
          <span className="font-medium">{locale.toUpperCase()}</span>
        </button>
      </div>
    </header>
  );
}
