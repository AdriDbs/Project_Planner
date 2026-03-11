import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Database, Sliders, BarChart3,
  TrendingUp, Users, DollarSign, Settings, FileX, ChevronRight, Library,
  FileSpreadsheet
} from 'lucide-react';

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
  return (
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
  );
}
