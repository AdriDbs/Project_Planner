import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  Library, Search, ChevronUp, ChevronDown, BookOpen,
  Pencil, EyeOff, Plus, CheckSquare, Download, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Modal } from '../components/ui/Modal';
import { useLeverLibrary } from '../hooks/useLeverLibrary';
import { useProjects, usePlants } from '../hooks/useProjects';
import type { LibraryLever } from '../types/leverLibrary';
import type { Lever } from '../types/lever';
import { IMPROVEMENT_STRUCTURES, LEVER_TYPES } from '../types/lever';
import { formatNumber } from '../lib/calculations';
import { useProjectStore } from '../store/projectStore';
import { exportLeversToExcel } from '../lib/exporters';

// ─── Modal : Activer dans un projet ────────────────────────────────────────────

interface InstantiateModalProps {
  lever: LibraryLever;
  onClose: () => void;
  onInstantiate: (projectId: string, plantId: string, overrides: Partial<Lever>) => Promise<void>;
}

function InstantiateModal({ lever, onClose, onInstantiate }: InstantiateModalProps) {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const { plants } = usePlants(projectId || null);
  const [plantId, setPlantId] = useState('');
  const [netSavings, setNetSavings] = useState(lever.referenceNetSavingsEUR);
  const [capex, setCapex] = useState(lever.referenceCapexEUR);
  const [fte, setFte] = useState(lever.referenceFTE);
  const [commitment, setCommitment] = useState<'Commitment' | 'Additional Potential' | 'No Go'>('Commitment');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";

  const handleSubmit = async () => {
    if (!projectId || !plantId) { toast.error('Sélectionnez un projet et une usine'); return; }
    setSaving(true);
    try {
      await onInstantiate(projectId, plantId, {
        netSavingsEUR: netSavings,
        netSavingsLC: netSavings,
        capexEUR: capex,
        capexLC: capex,
        fte,
        commitment,
        comment,
      });
      toast.success(`Levier "${lever.title}" instancié dans le projet`);
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-bp-primary/5 rounded-lg p-3">
        <p className="text-xs font-semibold text-bp-primary">{lever.leverId} — {lever.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{lever.department} · {lever.platform}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Projet *</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setPlantId(''); }} className={inputCls + ' bg-white'}>
            <option value="">— Sélectionner —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Usine *</label>
          <select value={plantId} onChange={e => setPlantId(e.target.value)} className={inputCls + ' bg-white'} disabled={!projectId}>
            <option value="">— Sélectionner —</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Net Savings (€)</label>
          <input type="number" value={netSavings} onChange={e => setNetSavings(+e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CAPEX (€)</label>
          <input type="number" value={capex} onChange={e => setCapex(+e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">FTE</label>
          <input type="number" step="0.1" value={fte} onChange={e => setFte(+e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Commitment</label>
        <select value={commitment} onChange={e => setCommitment(e.target.value as typeof commitment)} className={inputCls + ' bg-white'}>
          <option>Commitment</option>
          <option>Additional Potential</option>
          <option>No Go</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-ghost flex-1">Annuler</button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
          {saving ? 'Instanciation...' : 'Instancier le levier'}
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export function LeverLibraryPage() {
  const { locale } = useProjectStore();
  const { libraryLevers, loading, instantiateInProject, removeFromLibrary } = useLeverLibrary();
  const { projects } = useProjects();

  // Filtres
  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [usedFilter, setUsedFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Sélection en masse
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal instanciation
  const [instantiateTarget, setInstantiateTarget] = useState<LibraryLever | null>(null);
  // Bulk instanciation
  const [bulkInstantiateOpen, setBulkInstantiateOpen] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);

  // Options de filtres dérivées
  const platforms = useMemo(() =>
    [...new Set(libraryLevers.map(l => l.platform).filter(Boolean))].sort(),
    [libraryLevers]);

  const originNames = useMemo(() =>
    [...new Set(libraryLevers.map(l => l.originProjectName).filter(Boolean))].sort(),
    [libraryLevers]);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const filteredLevers = useMemo(() => {
    let data = libraryLevers;
    if (!showInactive) data = data.filter(l => l.isActive);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(l =>
        l.leverId?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q)
      );
    }
    if (structureFilter) data = data.filter(l => l.improvementStructure === structureFilter);
    if (typeFilter) data = data.filter(l => l.leverType === typeFilter);
    if (platformFilter) data = data.filter(l => l.platform === platformFilter);
    if (originFilter) data = data.filter(l => l.originProjectName === originFilter);
    if (usedFilter === 'used') data = data.filter(l => l.usedInProjects?.length > 0);
    if (usedFilter === 'unused') data = data.filter(l => !l.usedInProjects?.length);
    return data;
  }, [libraryLevers, showInactive, search, structureFilter, typeFilter, platformFilter, originFilter, usedFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLevers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLevers.map(l => l.id)));
    }
  };

  const handleBulkDeactivate = async () => {
    if (!confirm(`Désactiver ${selectedIds.size} levier(s) ?`)) return;
    for (const id of selectedIds) {
      await removeFromLibrary(id);
    }
    setSelectedIds(new Set());
    toast.success('Leviers désactivés');
  };

  const handleBulkExport = () => {
    const toExport = filteredLevers.filter(l => selectedIds.has(l.id)).map(l => ({
      id: '',
      projectId: '',
      plantId: '',
      libraryLeverId: l.id,
      isFromLibrary: true,
      leverId: l.leverId,
      title: l.title,
      platform: l.platform,
      department: l.department,
      source: l.source as Lever['source'],
      improvementStructure: l.improvementStructure as Lever['improvementStructure'],
      leverType: l.leverType as Lever['leverType'],
      digitalizationMechanization: l.digitalizationMechanization as Lever['digitalizationMechanization'],
      inBudget: false,
      inScope: true,
      commitment: 'Commitment' as Lever['commitment'],
      savingsByYear: {},
      fyTotalSavingsLC: 0,
      capexLC: l.referenceCapexEUR,
      approvedCapexLC: 0,
      oneOffOpexLC: 0,
      recurringOpexLC: 0,
      netSavingsLC: l.referenceNetSavingsEUR,
      fyTotalSavingsEUR: 0,
      capexEUR: l.referenceCapexEUR,
      approvedCapexEUR: 0,
      oneOffOpexEUR: 0,
      recurringOpexEUR: 0,
      netSavingsEUR: l.referenceNetSavingsEUR,
      payback: l.referencePayback,
      benefits: l.benefits,
      feasibility: l.feasibility,
      comment: '',
      fteSavingsType: 'Soft' as Lever['fteSavingsType'],
      fte: l.referenceFTE,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Lever));
    exportLeversToExcel(toExport, [], 'library_export.xlsx');
    toast.success('Export Excel généré');
  };

  const columns = useMemo<ColumnDef<LibraryLever>[]>(() => [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.size === filteredLevers.length && filteredLevers.length > 0}
          onChange={toggleSelectAll}
          className="rounded"
        />
      ),
      size: 40,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="rounded"
        />
      ),
    },
    {
      id: 'leverId',
      accessorKey: 'leverId',
      header: 'ID',
      size: 80,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-bp-primary">{getValue() as string}</span>
      ),
    },
    { id: 'title', accessorKey: 'title', header: 'Titre', size: 260, cell: ({ getValue }) => (
      <span className="text-xs text-gray-700 leading-tight line-clamp-2">{getValue() as string}</span>
    )},
    { id: 'department', accessorKey: 'department', header: 'Département', size: 120 },
    { id: 'improvementStructure', accessorKey: 'improvementStructure', header: 'Structure', size: 100 },
    { id: 'leverType', accessorKey: 'leverType', header: 'Type', size: 130, cell: ({ getValue }) => (
      <span className="text-xs text-gray-600 leading-tight line-clamp-2">{getValue() as string}</span>
    )},
    {
      id: 'benefits',
      accessorKey: 'benefits',
      header: 'Bénéfices',
      size: 90,
      cell: ({ getValue }) => <BenefitsBar value={getValue() as number} />,
    },
    {
      id: 'feasibility',
      accessorKey: 'feasibility',
      header: 'Faisabilité',
      size: 90,
      cell: ({ getValue }) => <BenefitsBar value={getValue() as number} color="blue" />,
    },
    {
      id: 'referenceNetSavingsEUR',
      accessorKey: 'referenceNetSavingsEUR',
      header: 'Ref. Savings (€)',
      size: 120,
      cell: ({ getValue }) => (
        <span className={`font-mono text-xs font-semibold text-right block ${(getValue() as number) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {formatNumber(getValue() as number, locale)}
        </span>
      ),
    },
    {
      id: 'referenceCapexEUR',
      accessorKey: 'referenceCapexEUR',
      header: 'Ref. CAPEX (€)',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-right block">{formatNumber(getValue() as number, locale)}</span>
      ),
    },
    {
      id: 'origin',
      header: 'Origine',
      size: 160,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bp-primary/10 text-bp-primary text-xs font-medium">
          {row.original.originProjectName || '—'}
        </span>
      ),
    },
    {
      id: 'usedIn',
      header: 'Utilisé',
      size: 110,
      cell: ({ row }) => {
        const ids = row.original.usedInProjects || [];
        const names = ids.map(id => projectMap[id] || id).join(', ');
        return (
          <span
            title={names || 'Aucun projet'}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs cursor-default"
          >
            {ids.length} projet{ids.length !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Statut',
      size: 80,
      cell: ({ row }) => row.original.isActive
        ? <span className="text-xs text-green-700 font-medium">Actif</span>
        : <span className="text-xs text-gray-400">Inactif</span>,
    },
    {
      id: 'actions',
      header: '',
      size: 110,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => setInstantiateTarget(row.original)}
            title="Activer dans un projet"
            className="p-1.5 hover:bg-bp-secondary/10 rounded text-bp-secondary hover:text-bp-primary transition-colors"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => removeFromLibrary(row.original.id).then(() => toast.success('Levier désactivé'))}
            title="Désactiver"
            className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors"
          >
            <EyeOff size={13} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedIds, filteredLevers, locale, projectMap]);

  const table = useReactTable({
    data: filteredLevers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-48 text-gray-400">Chargement de la bibliothèque...</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex h-full">
        {/* Panel gauche — Filtres */}
        <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Filter size={14} className="text-bp-primary" />
            <span className="text-sm font-semibold text-gray-700">Filtres</span>
          </div>
          <div className="px-4 py-4 space-y-4 flex-1">
            {/* Recherche texte */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Recherche</label>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ID, titre, département..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:border-bp-secondary"
                />
              </div>
            </div>

            <FilterSelect label="Structure" value={structureFilter} onChange={setStructureFilter} options={IMPROVEMENT_STRUCTURES} />
            <FilterSelect label="Type de levier" value={typeFilter} onChange={setTypeFilter} options={LEVER_TYPES} />
            <FilterSelect label="Plateforme" value={platformFilter} onChange={setPlatformFilter} options={platforms} />
            <FilterSelect label="Projet d'origine" value={originFilter} onChange={setOriginFilter} options={originNames} />

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Utilisation</label>
              <select value={usedFilter} onChange={e => setUsedFilter(e.target.value as typeof usedFilter)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-bp-secondary bg-white">
                <option value="all">Tous</option>
                <option value="used">Utilisés dans un projet</option>
                <option value="unused">Non utilisés</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-gray-600">Afficher les inactifs</span>
            </label>

            <button
              onClick={() => { setSearch(''); setStructureFilter(''); setTypeFilter(''); setPlatformFilter(''); setOriginFilter(''); setUsedFilter('all'); setShowInactive(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {/* Panel principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Library size={16} className="text-bp-primary" />
              <h2 className="font-semibold text-gray-800 text-sm">Bibliothèque de Leviers</h2>
              <span className="text-xs text-gray-400 ml-1">({filteredLevers.length} levier{filteredLevers.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-gray-500">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                  <button
                    onClick={() => setBulkInstantiateOpen(true)}
                    className="btn-primary flex items-center gap-1.5 text-xs px-3"
                  >
                    <Plus size={12} /> Activer dans un projet
                  </button>
                  <button
                    onClick={handleBulkExport}
                    className="btn-secondary flex items-center gap-1.5 text-xs px-3"
                  >
                    <Download size={12} /> Exporter
                  </button>
                  <button
                    onClick={handleBulkDeactivate}
                    className="btn-ghost flex items-center gap-1.5 text-xs px-3 text-red-600 hover:bg-red-50"
                  >
                    <EyeOff size={12} /> Désactiver
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '1300px' }}>
              <thead className="table-header sticky top-0 z-10">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize(), minWidth: header.getSize() }}
                        className="px-3 py-3 text-left font-semibold text-xs cursor-pointer select-none whitespace-nowrap"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <ChevronUp size={11} />}
                          {header.column.getIsSorted() === 'desc' && <ChevronDown size={11} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`${!row.original.isActive ? 'opacity-50' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                        className="px-3 py-2 border-b border-gray-100"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen size={32} className="text-gray-300" />
                        <p>Aucun levier dans la bibliothèque.</p>
                        <p className="text-xs">Exportez des leviers depuis la page Admin pour commencer.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                Précédent
              </button>
              <span className="text-xs text-gray-500">
                Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                Suivant
              </button>
            </div>
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              {[25, 50, 100].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Modal instanciation unitaire */}
      {instantiateTarget && (
        <Modal
          isOpen={true}
          onClose={() => setInstantiateTarget(null)}
          title="Activer dans un projet"
          size="md"
        >
          <InstantiateModal
            lever={instantiateTarget}
            onClose={() => setInstantiateTarget(null)}
            onInstantiate={(pId, plId, overrides) =>
              instantiateInProject(instantiateTarget.id, pId, plId, overrides)
            }
          />
        </Modal>
      )}

      {/* Modal instanciation en masse */}
      {bulkInstantiateOpen && (
        <BulkInstantiateModal
          levers={filteredLevers.filter(l => selectedIds.has(l.id))}
          onClose={() => setBulkInstantiateOpen(false)}
          onInstantiate={async (projectId, plantId) => {
            for (const lever of filteredLevers.filter(l => selectedIds.has(l.id))) {
              await instantiateInProject(lever.id, projectId, plantId);
            }
            setSelectedIds(new Set());
            toast.success(`${selectedIds.size} leviers instanciés`);
            setBulkInstantiateOpen(false);
          }}
        />
      )}
    </PageWrapper>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-bp-secondary bg-white"
      >
        <option value="">Tous</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function BenefitsBar({ value, color = 'green' }: { value: number; color?: 'green' | 'blue' }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-sm ${i <= value
            ? color === 'green' ? 'bg-green-500' : 'bg-bp-secondary'
            : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="text-xs text-gray-500 ml-0.5">{value}/5</span>
    </div>
  );
}

interface BulkInstantiateModalProps {
  levers: LibraryLever[];
  onClose: () => void;
  onInstantiate: (projectId: string, plantId: string) => Promise<void>;
}

function BulkInstantiateModal({ levers, onClose, onInstantiate }: BulkInstantiateModalProps) {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const { plants } = usePlants(projectId || null);
  const [plantId, setPlantId] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";

  const handleSubmit = async () => {
    if (!projectId || !plantId) { toast.error('Sélectionnez un projet et une usine'); return; }
    setSaving(true);
    try {
      await onInstantiate(projectId, plantId);
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Activer ${levers.length} levier(s) dans un projet`} size="sm">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
          {levers.map(l => (
            <p key={l.id} className="text-xs text-gray-600">
              <span className="font-mono font-semibold text-bp-primary">{l.leverId}</span> — {l.title}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Projet *</label>
            <select value={projectId} onChange={e => { setProjectId(e.target.value); setPlantId(''); }} className={inputCls + ' bg-white'}>
              <option value="">— Sélectionner —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Usine *</label>
            <select value={plantId} onChange={e => setPlantId(e.target.value)} className={inputCls + ' bg-white'} disabled={!projectId}>
              <option value="">— Sélectionner —</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Instanciation...' : `Instancier ${levers.length} levier(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
