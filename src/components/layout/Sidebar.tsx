import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Database, Sliders, BarChart3, PieChart,
  TrendingUp, Users, DollarSign, Settings, FileX, Download,
  Users2, PencilLine, Wrench, ChevronDown, HelpCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  defaultOpen: boolean;
  items: NavItem[];
};

type NavSection =
  | { type: 'item'; item: NavItem }
  | { type: 'group'; group: NavGroup };

const NAV_SECTIONS: NavSection[] = [
  {
    type: 'item',
    item: { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  },
  {
    type: 'group',
    group: {
      label: 'Saisie des données',
      icon: PencilLine,
      defaultOpen: true,
      items: [
        { to: '/baseline', icon: Database, label: 'Baseline' },
        { to: '/levers', icon: Sliders, label: 'Performance Levers' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      label: 'Restitutions',
      icon: BarChart3,
      defaultOpen: true,
      items: [
        { to: '/savings-by-type', icon: PieChart, label: 'Savings par Nature' },
        { to: '/phasing', icon: TrendingUp, label: 'Phasing des Savings' },
        { to: '/organization', icon: Users, label: 'Organisation & FTE' },
        { to: '/capex-opex', icon: DollarSign, label: 'CAPEX & OPEX' },
        { to: '/out-of-scope', icon: FileX, label: 'Out of Scope' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      label: 'Outils',
      icon: Wrench,
      defaultOpen: false,
      items: [
        { to: '/export', icon: Download, label: 'Export Excel' },
        { to: '/workshop', icon: Users2, label: 'Workshop Client' },
      ],
    },
  },
  {
    type: 'item',
    item: { to: '/admin', icon: Settings, label: 'Administration' },
  },
];

// Flat list of all leaf nav items (used in collapsed mode)
const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s =>
  s.type === 'item' ? [s.item] : s.group.items
);

const STORAGE_KEY = 'bp_sidebar_groups';
const COLLAPSED_KEY = 'bp_sidebar_collapsed';

function loadGroupStates(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupStates(states: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // ignore
  }
}

function NavGroupSection({ group, openState, onToggle }: {
  group: NavGroup;
  openState: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const hasActiveChild = group.items.some(i => location.pathname === i.to);

  // Auto-expand if a child is active
  useEffect(() => {
    if (hasActiveChild && !openState) {
      onToggle();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div>
      <button
        onClick={onToggle}
        data-group={group.label}
        className="w-full flex items-center gap-2 px-3 py-1.5 mt-3 mb-1
                   text-white/40 hover:text-white/60 transition-colors text-xs
                   font-semibold uppercase tracking-widest select-none"
      >
        <group.icon size={12} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${openState ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          openState ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-2 space-y-0.5 border-l border-white/10 ml-4">
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `nav-item text-xs py-2 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={15} />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { startTutorial } = useProjectStore();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Initialize group open states from localStorage or defaults
  const [groupStates, setGroupStates] = useState<Record<string, boolean>>(() => {
    const saved = loadGroupStates();
    const initial: Record<string, boolean> = {};
    for (const section of NAV_SECTIONS) {
      if (section.type === 'group') {
        const label = section.group.label;
        initial[label] = label in saved ? saved[label] : section.group.defaultOpen;
      }
    }
    return initial;
  });

  const toggleGroup = (label: string) => {
    setGroupStates(prev => {
      const next = { ...prev, [label]: !prev[label] };
      saveGroupStates(next);
      return next;
    });
  };

  return (
    <aside
      className={`${isCollapsed ? 'w-14' : 'w-64'} min-h-screen bg-bp-primary flex flex-col flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden`}
    >
      {/* Logo / Brand */}
      <div className={`py-5 border-b border-white/10 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-bp-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">BearingPoint</p>
              <p className="text-white/60 text-xs whitespace-nowrap">Performance Levers</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={toggleCollapsed}
            title="Réduire la barre latérale"
            className="flex-shrink-0 p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 ${isCollapsed ? 'px-1' : 'px-3'} overflow-y-auto`}>
        {isCollapsed ? (
          /* Collapsed: flat icon list */
          <div className="space-y-1">
            {ALL_NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center justify-center p-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
              </NavLink>
            ))}
          </div>
        ) : (
          /* Expanded: full grouped nav */
          NAV_SECTIONS.map((section) => {
            if (section.type === 'item') {
              const { item } = section;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
                  }
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              );
            }

            const { group } = section;
            return (
              <NavGroupSection
                key={group.label}
                group={group}
                openState={groupStates[group.label] ?? group.defaultOpen}
                onToggle={() => toggleGroup(group.label)}
              />
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className={`pt-2 pb-2 border-t border-white/10 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        {isCollapsed ? (
          /* Collapsed footer: expand toggle + help icon */
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleCollapsed}
              title="Agrandir la barre latérale"
              className="p-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={startTutorial}
              title="Tutoriel guidé"
              data-tutorial-trigger
              className="p-2.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={startTutorial}
              data-tutorial-trigger
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                         text-white/50 hover:text-white/80 hover:bg-white/10
                         transition-colors text-xs mb-2"
            >
              <HelpCircle size={14} />
              <span>Tutoriel guidé</span>
            </button>
            <p className="text-white/30 text-xs px-3">v1.0 — Usage Interne</p>
            <p className="text-white/30 text-xs px-3">© BearingPoint 2025</p>
          </>
        )}
      </div>
    </aside>
  );
}
