import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Database, Sliders, BarChart3,
  TrendingUp, Users, DollarSign, Settings, FileX, ChevronRight, Library,
  FileSpreadsheet, Presentation
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { WorkshopLauncher } from '../workshop/WorkshopLauncher';
import { useProjectStore } from '../../store/projectStore';
import { useProjects, usePlants } from '../../hooks/useProjects';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/baseline', icon: Database, label: 'Baseline' },
  { to: '/levers', icon: Sliders, label: 'Performance Levers' },
  { to: '/savings-by-type', icon: BarChart3, label: 'Savings par Nature' },
  { to: '/phasing', icon: TrendingUp, label: 'Phasing Savings' },
  { to: '/organization', icon: Users, label: 'Organisation FTE' },
  { to: '/capex-opex', icon: DollarSign, label: 'CAPEX & OPEX' },
  { to: '/out-of-scope', icon: FileX, label: 'Out of Scope' },
  { to: '/export', icon: FileSpreadsheet, label: 'Export Excel' },
  { to: '/admin/library', icon: Library, label: 'Bibliothèque' },
  { to: '/admin', icon: Settings, label: 'Administration' },
];

export function Sidebar() {
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const { selectedProjectId } = useProjectStore();
  const { projects } = useProjects();
  const { plants } = usePlants(selectedProjectId);

  const project = projects.find(p => p.id === selectedProjectId);

  return (
    <>
      <aside className="w-64 min-h-screen bg-bp-primary flex flex-col">
        {/* Logo / Brand */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bp-secondary rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">BearingPoint</p>
              <p className="text-white/60 text-xs">Performance Levers</p>
            </div>
          </div>
        </div>

        {/* Workshop CTA */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setWorkshopOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-bp-secondary/20 hover:bg-bp-secondary/30 text-white rounded-xl transition-colors border border-bp-secondary/30 hover:border-bp-secondary/50"
          >
            <div className="w-6 h-6 bg-bp-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <Presentation size={14} className="text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-semibold truncate">Co-construction Workshop</div>
              <div className="text-white/50 text-xs">Lancer un atelier</div>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-white/40 text-xs">v1.0 — Usage Interne</p>
          <p className="text-white/40 text-xs">© BearingPoint 2025</p>
        </div>
      </aside>

      {/* Workshop launcher modal */}
      {project && (
        <Modal
          isOpen={workshopOpen}
          onClose={() => setWorkshopOpen(false)}
          title="Co-construction Workshop"
          size="lg"
        >
          <WorkshopLauncher
            project={project}
            plants={plants}
            onClose={() => setWorkshopOpen(false)}
          />
        </Modal>
      )}

      {!project && workshopOpen && (
        <Modal
          isOpen={workshopOpen}
          onClose={() => setWorkshopOpen(false)}
          title="Co-construction Workshop"
          size="sm"
        >
          <div className="text-center py-6">
            <Presentation size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 text-sm mb-4">
              Sélectionnez un projet dans la barre de navigation avant de lancer un atelier.
            </p>
            <button onClick={() => setWorkshopOpen(false)} className="btn-primary">
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
