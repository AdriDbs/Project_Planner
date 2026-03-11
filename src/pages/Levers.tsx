import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table';
import {
  Plus, Upload, Download, Trash2, Edit3, Search,
  ChevronUp, ChevronDown, BookOpen, Library, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { CommitmentBadge } from '../components/ui/Badge';
import { LeverForm } from '../components/forms/LeverForm';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { usePlants } from '../hooks/useProjects';
import { useLeverLibrary } from '../hooks/useLeverLibrary';
import { IMPROVEMENT_STRUCTURES } from '../types/lever';
import type { Lever } from '../types/lever';
import type { LibraryLever } from '../types/leverLibrary';
import { formatNumber } from '../lib/calculations';
import { parseLeversExcel } from '../lib/importers';
import { exportLeversToExcel } from '../lib/exporters';

// ─── Modal : Importer depuis la bibliothèque ────────────────────────────────────

interface ImportFromLibraryModalProps {
  projectId: string;
  projectLevers: Lever[];
  plants: { id: string; name: string }[];
  onClose: () => void;
  onImport: (libraryLeverId: string, plantId: string) => Promise<void>;
}

function ImportFromLibraryModal({ projectId, projectLevers, plants, onClose, onImport }: ImportFromLibraryModalProps) {
  const { libraryLevers } = useLeverLibrary();
  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plantId, setPlantId] = useState(plants[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const alreadyInProject = useMemo(() => {
    const ids = new Set<string>();
    projectLevers.forEach(l => { if (l.libraryLeverId) ids.add(l.libraryLeverId); });
    return ids;
  }, [projectLevers]);

  const filtered = useMemo(() => {
    let data = libraryLevers.filter(l => l.isActive);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(l =>
        l.leverId?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q)
      );
    }
    if (structureFilter) data = data.filter(l => l.improvementStructure === structureFilter);
    return data;
  }, [libraryLevers, search, structureFilter]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!selectedIds.size || !plantId) { toast.error('Sélectionnez une usine et au moins un levier'); return; }
    setSaving(true);
    try {
      for (const libId of selectedIds) {
        await onImport(libId, plantId);
      }
      toast.success(`${selectedIds.size} levier(s) importé(s)`);
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur d'usine */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Usine cible :</label>
        <select
          value={plantId}
          onChange={e => setPlantId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-bp-secondary bg-white flex-1"
        >
          {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans la bibliothèque..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:border-bp-secondary"
          />
        </div>
        <select
          value={structureFilter}
          onChange={e => setStructureFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-bp-secondary bg-white"
        >
          <option value="">Toutes structures</option>
          {IMPROVEMENT_STRUCTURES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table bibliothèque */}
      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={() => {
                    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filtered.filter(l => !alreadyInProject.has(l.id)).map(l => l.id)));
                  }}
                  className="rounded"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Titre</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Structure</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lever: LibraryLever, i) => {
              const alreadyPresent = alreadyInProject.has(lever.id);
              return (
                <tr key={lever.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lever.id)}
                      onChange={() => !alreadyPresent && toggle(lever.id)}
                      disabled={alreadyPresent}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-bp-primary">{lever.leverId}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{lever.title}</td>
                  <td className="px-3 py-2 text-gray-500">{lever.improvementStructure}</td>
                  <td className="px-3 py-2">
                    {alreadyPresent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        Déjà dans ce projet
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Disponible</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Aucun levier dans la bibliothèque</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-ghost flex-1">Annuler</button>
        <button onClick={handleImport} disabled={!selectedIds.size || saving} className="btn-primary flex-1">
          {saving ? 'Import...' : `Ajouter au projet (${selectedIds.size})`}
        </button>
      </div>
    </div>
  );
}

// ─── Page Leviers ───────────────────────────────────────────────────────────────

export function LeversPage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading, saving, createLever, updateLever, deleteLever, importLevers } = useLevers(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);
  const { instantiateInProject, libraryLevers } = useLeverLibrary();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLever, setEditingLever] = useState<Lever | null>(null);
  const [importLibraryOpen, setImportLibraryOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [commitmentFilter, setCommitmentFilter] = useState<string>('');
  const [structureFilter, setStructureFilter] = useState<string>('');

  const plantMap = useMemo(() => {
    const m: Record<string, string> = {};
    plants.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [plants]);

  // Map libraryLeverId -> originProjectName pour les tooltips
  const libraryMap = useMemo(() => {
    const m: Record<string, string> = {};
    libraryLevers.forEach(l => { m[l.id] = l.originProjectName; });
    return m;
  }, [libraryLevers]);

  const filteredLevers = useMemo(() => {
    let data = levers;
    if (commitmentFilter) data = data.filter(l => l.commitment === commitmentFilter);
    if (structureFilter) data = data.filter(l => l.improvementStructure === structureFilter);
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      data = data.filter(l =>
        l.leverId?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q) ||
        plantMap[l.plantId]?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [levers, commitmentFilter, structureFilter, globalFilter, plantMap]);

  const columns = useMemo<ColumnDef<Lever>[]>(() => [
    { id: 'leverId', accessorKey: 'leverId', header: 'ID', size: 80, cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold text-bp-primary">{getValue() as string}</span>
    )},
    { id: 'plant', accessorFn: row => plantMap[row.plantId] || row.plantId, header: 'Usine', size: 100 },
    { id: 'department', accessorKey: 'department', header: 'Département', size: 130 },
    { id: 'title', accessorKey: 'title', header: 'Levier', size: 260, cell: ({ getValue }) => (
      <span className="text-xs text-gray-700 leading-tight line-clamp-2">{getValue() as string}</span>
    )},
    { id: 'improvementStructure', accessorKey: 'improvementStructure', header: 'Structure', size: 110 },
    { id: 'commitment', accessorKey: 'commitment', header: 'Commitment', size: 160, cell: ({ getValue }) => (
      <CommitmentBadge value={getValue() as string} />
    )},
    {
      id: 'source',
      header: 'Source',
      size: 140,
      cell: ({ row }) => {
        const lever = row.original;
        if (lever.isFromLibrary && lever.libraryLeverId) {
          const origin = libraryMap[lever.libraryLeverId];
          return (
            <span
              title={origin ? `Origine : ${origin}` : 'Depuis la bibliothèque'}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bp-secondary/10 text-bp-secondary text-xs font-medium cursor-default"
            >
              <Library size={10} />
              Bibliothèque
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
            <Pencil size={10} />
            Local
          </span>
        );
      },
    },
    ...selectedYears.map(year => ({
      id: `year_${year}`,
      header: String(year),
      size: 90,
      cell: ({ row }: any) => (
        <span className="font-mono text-xs text-right block">
          {formatNumber(row.original.savingsByYear?.[String(year)] || 0, locale)}
        </span>
      ),
    })),
    { id: 'fyTotalSavingsEUR', accessorKey: 'fyTotalSavingsEUR', header: 'FY Total (€)', size: 110,
      cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-right block">{formatNumber(getValue() as number, locale)}</span>
    },
    { id: 'capexEUR', accessorKey: 'capexEUR', header: 'CAPEX (€)', size: 110,
      cell: ({ getValue }) => <span className="font-mono text-xs text-right block">{formatNumber(getValue() as number, locale)}</span>
    },
    { id: 'netSavingsEUR', accessorKey: 'netSavingsEUR', header: 'Net Savings (€)', size: 120,
      cell: ({ getValue }) => (
        <span className={`font-mono text-xs font-bold text-right block ${(getValue() as number) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {formatNumber(getValue() as number, locale)}
        </span>
      )
    },
    { id: 'actions', header: '', size: 70, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditingLever(row.original); setIsModalOpen(true); }}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-bp-primary transition-colors">
          <Edit3 size={13} />
        </button>
        <button onClick={() => handleDelete(row.original.id)}
          className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    )},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedYears, locale, plantMap, libraryMap]);

  const table = useReactTable({
    data: filteredLevers,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const handleCreateLever = async (data: Omit<Lever, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createLever(data);
      setIsModalOpen(false);
      setEditingLever(null);
      toast.success('Levier créé avec succès');
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  const handleEditLever = async (data: Omit<Lever, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingLever) return;
    try {
      await updateLever(editingLever.id, data);
      setIsModalOpen(false);
      setEditingLever(null);
      toast.success('Levier mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce levier ?')) return;
    try {
      await deleteLever(id);
      toast.success('Levier supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    const plantNameToId: Record<string, string> = {};
    plants.forEach(p => { plantNameToId[p.name] = p.id; });

    try {
      const data = await parseLeversExcel(file, selectedProjectId, plantNameToId, selectedYears);
      await importLevers(data);
      toast.success(`${data.length} leviers importés avec succès`);
    } catch (err) {
      toast.error(`Erreur d'import: ${(err as Error).message}`);
    }
    e.target.value = '';
  };

  const handleExport = () => {
    exportLeversToExcel(levers, selectedYears, 'levers_export.xlsx');
    toast.success('Export Excel généré');
  };

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }

  if (loading) return <PageWrapper><PageLoader /></PageWrapper>;

  return (
    <PageWrapper className="!p-0">
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bp-secondary w-52"
              />
            </div>

            {/* Filters */}
            <select
              value={commitmentFilter}
              onChange={e => setCommitmentFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-white"
            >
              <option value="">Tous les commitments</option>
              <option>Commitment</option>
              <option>Additional Potential</option>
              <option>No Go</option>
            </select>
            <select
              value={structureFilter}
              onChange={e => setStructureFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-white"
            >
              <option value="">Toutes les structures</option>
              {IMPROVEMENT_STRUCTURES.map(s => <option key={s}>{s}</option>)}
            </select>

            <span className="text-xs text-gray-500 ml-2">
              {filteredLevers.length} levier{filteredLevers.length !== 1 ? 's' : ''}
              {saving && <span className="ml-2 text-bp-secondary">· Sauvegarde...</span>}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setImportLibraryOpen(true)}
              className="btn-secondary flex items-center gap-2 text-xs px-3"
            >
              <BookOpen size={13} />
              Importer depuis la bibliothèque
            </button>
            <label className="btn-ghost flex items-center gap-2 cursor-pointer text-xs px-3">
              <Upload size={13} />
              Importer Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={handleExport} className="btn-ghost flex items-center gap-2 text-xs px-3">
              <Download size={13} />
              Exporter
            </button>
            <button
              onClick={() => { setEditingLever(null); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              <Plus size={13} />
              Nouveau Levier
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: '1500px' }}>
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
                <tr key={row.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}>
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
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                    Aucun levier trouvé. Créez un nouveau levier ou importez un fichier Excel.
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Lignes par page:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              {[25, 50, 100, 200].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Modal lever form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLever(null); }}
        title={editingLever ? `Modifier Levier ${editingLever.leverId}` : 'Nouveau Levier de Performance'}
        size="2xl"
      >
        {selectedProjectId && (
          <LeverForm
            projectId={selectedProjectId}
            onSubmit={editingLever ? handleEditLever : handleCreateLever}
            onCancel={() => { setIsModalOpen(false); setEditingLever(null); }}
            initialData={editingLever || undefined}
          />
        )}
      </Modal>

      {/* Modal import depuis bibliothèque */}
      {importLibraryOpen && selectedProjectId && (
        <Modal
          isOpen={true}
          onClose={() => setImportLibraryOpen(false)}
          title="Importer depuis la bibliothèque"
          size="xl"
        >
          <ImportFromLibraryModal
            projectId={selectedProjectId}
            projectLevers={levers}
            plants={plants}
            onClose={() => setImportLibraryOpen(false)}
            onImport={async (libId, plId) => {
              await instantiateInProject(libId, selectedProjectId, plId);
            }}
          />
        </Modal>
      )}
    </PageWrapper>
  );
}
