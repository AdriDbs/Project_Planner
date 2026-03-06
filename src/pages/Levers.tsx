import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table';
import { Plus, Upload, Download, Trash2, Edit3, Search, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';
import { CommitmentBadge } from '../components/ui/Badge';
import { LeverForm } from '../components/forms/LeverForm';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { usePlants } from '../hooks/useProjects';
import { IMPROVEMENT_STRUCTURES } from '../types/lever';
import type { Lever } from '../types/lever';
import { formatNumber } from '../lib/calculations';
import { parseLeversExcel } from '../lib/importers';
import { exportLeversToExcel } from '../lib/exporters';

export function LeversPage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading, saving, createLever, updateLever, deleteLever, importLevers } = useLevers(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLever, setEditingLever] = useState<Lever | null>(null);
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
    { id: 'title', accessorKey: 'title', header: 'Levier', size: 280, cell: ({ getValue }) => (
      <span className="text-xs text-gray-700 leading-tight line-clamp-2">{getValue() as string}</span>
    )},
    { id: 'improvementStructure', accessorKey: 'improvementStructure', header: 'Structure', size: 110 },
    { id: 'commitment', accessorKey: 'commitment', header: 'Commitment', size: 160, cell: ({ getValue }) => (
      <CommitmentBadge value={getValue() as string} />
    )},
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
  ], [selectedYears, locale, plantMap]);

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
            <label className="btn-secondary flex items-center gap-2 cursor-pointer text-xs px-3">
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
          <table className="w-full text-xs border-collapse" style={{ minWidth: '1400px' }}>
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

      {/* Modal */}
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
    </PageWrapper>
  );
}
