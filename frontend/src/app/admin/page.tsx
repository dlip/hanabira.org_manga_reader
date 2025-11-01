'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChartBarIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface DBStats {
  database_size_bytes: number;
  database_size_mb: number;
  total_tables: number;
  total_records: number;
  table_counts: Record<string, number>;
  sqlite_version: string;
}

interface ColumnInfo { cid: number; name: string; type: string; not_null: boolean; default_value: unknown; primary_key: boolean; }
interface ForeignKeyInfo { id: number; seq: number; table: string; from: string; to: string; on_update: string; on_delete: string; }
interface TableSchema { columns: ColumnInfo[]; foreign_keys: ForeignKeyInfo[]; row_count: number; }

interface TableDataResponse {
  success: boolean;
  table: string;
  data: Record<string, unknown>[];
  pagination: { page: number; per_page: number; total_rows: number; total_pages: number };
  error?: string;
}
interface SchemaResponse { success: boolean; schema?: Record<string, TableSchema>; error?: string; }
interface StatsResponse { success: boolean; stats?: DBStats; error?: string; }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'data' | 'maintenance'>('overview');
  const [stats, setStats] = useState<DBStats | null>(null);
  const [schema, setSchema] = useState<Record<string, TableSchema> | null>(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(null);
  const [integrityResult, setIntegrityResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/admin/database/stats`);
      const json: StatsResponse = await r.json();
      if (json.success && json.stats) setStats(json.stats); else setError(json.error || 'Failed to load stats');
    } catch { setError('Failed to load stats'); }
  }, []);

  const fetchSchema = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/admin/database/schema`);
      const json: SchemaResponse = await r.json();
      if (json.success && json.schema) {
        setSchema(json.schema);
        if (!selectedTable) {
          const first = Object.keys(json.schema)[0];
            if (first) setSelectedTable(first);
        }
      } else setError(json.error || 'Failed to load schema');
    } catch { setError('Failed to load schema'); }
  }, [selectedTable]);

  const fetchTable = useCallback(async (table: string, pg: number) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/admin/database/table/${table}?page=${pg}&per_page=50`);
      const json: TableDataResponse = await r.json();
      if (json.success) setTableData(json); else setError(json.error || 'Failed to load table');
    } catch { setError('Failed to load table'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchSchema(); }, [fetchStats, fetchSchema]);
  useEffect(() => { 
    if (activeTab === 'data' && selectedTable) fetchTable(selectedTable, page); 
  }, [activeTab, selectedTable, page, fetchTable]);

  const exportTableCSV = async (tableName: string) => {
    setMaintenanceLoading('export');
    try {
      const response = await fetch(`${API_BASE_URL}/admin/database/export/${tableName}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setError('Failed to export table');
      }
    } catch {
      setError('Export failed');
    } finally {
      setMaintenanceLoading(null);
    }
  };

  const backupDatabase = async () => {
    setMaintenanceLoading('backup');
    try {
      const response = await fetch(`${API_BASE_URL}/admin/database/backup`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `database_backup_${new Date().toISOString().split('T')[0]}.db`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setError('Failed to create backup');
      }
    } catch {
      setError('Backup failed');
    } finally {
      setMaintenanceLoading(null);
    }
  };

  const checkIntegrity = async () => {
    setMaintenanceLoading('integrity');
    try {
      const response = await fetch(`${API_BASE_URL}/admin/database/integrity`);
      const result = await response.json();
      if (result.success) {
        setIntegrityResult(result.result);
      } else {
        setError(result.error || 'Integrity check failed');
      }
    } catch {
      setError('Integrity check failed');
    } finally {
      setMaintenanceLoading(null);
    }
  };

  const formatValue = (v: unknown) => {
    if (v === null) return <span className="italic text-gray-500">null</span>;
    if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v;
    return String(v);
  };
  const resetError = () => setError(null);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Database Admin</h1>
            <p className="text-sm text-gray-600 mt-1">Read‑only inspection of local SQLite data</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline">← Back</Link>
        </header>

        <nav className="flex gap-6 border-b border-gray-200 text-sm">
          {(['overview','schema','data','maintenance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetError(); }}
              className={`py-2 -mb-px border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >{tab}</button>
          ))}
        </nav>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start justify-between gap-4">
            <div className="text-sm">{error}</div>
            <button onClick={resetError} className="text-xs uppercase tracking-wide">dismiss</button>
          </div>
        )}

        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-white rounded-lg border p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Database Size</h3>
                <p className="text-2xl font-semibold text-blue-600">{stats.database_size_mb} MB</p>
                <p className="text-xs text-gray-400">{stats.database_size_bytes} bytes</p>
              </div>
              <div className="bg-white rounded-lg border p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Records</h3>
                <p className="text-2xl font-semibold text-green-600">{stats.total_records.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Across {stats.total_tables} tables</p>
              </div>
              <div className="bg-white rounded-lg border p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-1">SQLite Version</h3>
                <p className="text-2xl font-semibold text-purple-600">{stats.sqlite_version}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Table Record Counts</h3>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Object.entries(stats.table_counts).map(([t,c]) => (
                  <div key={t} className="rounded border px-3 py-2 bg-gray-50">
                    <div className="text-xs font-medium text-gray-500 truncate">{t}</div>
                    <div className="text-lg font-semibold text-gray-800">{c.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schema' && schema && (
          <div className="space-y-8">
            {Object.entries(schema).map(([t, sch]) => (
              <div key={t} className="bg-white rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{t}</h3>
                  <span className="text-xs text-gray-500">{sch.row_count} rows</span>
                </div>
                <div className="p-5 space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Columns</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Name</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">Constraints</th>
                            <th className="px-3 py-2 text-left font-medium">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {sch.columns.map(col => (
                            <tr key={col.cid} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-gray-900">{col.name}</td>
                              <td className="px-3 py-2 font-mono text-blue-700/90">{col.type}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {col.primary_key && <span className="px-2 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700">PK</span>}
                                  {col.not_null && <span className="px-2 py-0.5 text-[10px] rounded bg-red-100 text-red-700">NOT NULL</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-600 font-mono text-xs">{col.default_value === null ? <span className="italic text-gray-400">—</span> : String(col.default_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {sch.foreign_keys.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Foreign Keys</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">From</th>
                              <th className="px-3 py-2 text-left font-medium">References</th>
                              <th className="px-3 py-2 text-left font-medium">On Delete</th>
                              <th className="px-3 py-2 text-left font-medium">On Update</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {sch.foreign_keys.map(fk => (
                              <tr key={fk.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-gray-900">{fk.from}</td>
                                <td className="px-3 py-2 font-mono text-purple-700/90">{fk.table}.{fk.to}</td>
                                <td className="px-3 py-2 text-gray-600">{fk.on_delete}</td>
                                <td className="px-3 py-2 text-gray-600">{fk.on_update}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'data' && schema && (
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3 items-center">
                <label htmlFor="admin-table-select" className="text-sm font-medium text-gray-700">Table:</label>
                <select
                  id="admin-table-select"
                  aria-label="Select database table"
                  value={selectedTable}
                  onChange={(e) => { setSelectedTable(e.target.value); setPage(1); }}
                  className="border rounded px-2 py-1 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
                >
                  {Object.keys(schema).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {tableData && (
                <div className="text-xs text-gray-500">
                  Page {tableData.pagination.page} / {tableData.pagination.total_pages} • {tableData.pagination.total_rows} rows
                </div>
              )}
            </div>

            {loading && (
              <div className="bg-white border rounded-lg p-10 text-center text-sm text-gray-600">Loading…</div>
            )}

            {!loading && tableData && (
              <div className="bg-white border rounded-lg overflow-hidden">
                {tableData.data.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500">No rows</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          {Object.keys(tableData.data[0]).map(col => (
                            <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tableData.data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.entries(row).map(([k, v]) => (
                              <td key={k} className="px-3 py-2 align-top max-w-xs text-gray-900">
                                <div className="truncate font-medium" title={typeof v === 'string' ? v : undefined}>{formatValue(v)}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {tableData.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-xs text-gray-600">
                    <div>Page {tableData.pagination.page} / {tableData.pagination.total_pages}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2 py-1 border rounded disabled:opacity-40"
                      >Prev</button>
                      <button
                        onClick={() => setPage(p => tableData ? Math.min(tableData.pagination.total_pages, p + 1) : p)}
                        disabled={page === tableData.pagination.total_pages}
                        className="px-2 py-1 border rounded disabled:opacity-40"
                      >Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Maintenance</h3>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Export Data */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">Export Table Data</h4>
                  <p className="text-sm text-gray-700 mb-3">Download table data as CSV files</p>
                  {schema && (
                    <div className="space-y-2">
                      {Object.keys(schema).map(tableName => (
                        <button
                          key={tableName}
                          onClick={() => exportTableCSV(tableName)}
                          disabled={maintenanceLoading === 'export'}
                          className="w-full text-left px-3 py-2 text-sm text-indigo-900 bg-indigo-100 border border-indigo-200 rounded hover:bg-indigo-200 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <ChartBarIcon className="w-4 h-4" />
                          {tableName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Database Backup */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">Database Backup</h4>
                  <p className="text-sm text-gray-700 mb-3">Download complete database file</p>
                  <button
                    onClick={backupDatabase}
                    disabled={maintenanceLoading === 'backup'}
                    className="w-full px-4 py-2 bg-emerald-300 text-emerald-900 rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {maintenanceLoading === 'backup' ? (
                      <div className="w-4 h-4 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ArrowDownTrayIcon className="w-5 h-5" />
                    )}
                    Download Backup
                  </button>
                </div>

                {/* Integrity Check */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">Integrity Check</h4>
                  <p className="text-sm text-gray-700 mb-3">Verify database consistency</p>
                  <button
                    onClick={checkIntegrity}
                    disabled={maintenanceLoading === 'integrity'}
                    className="w-full px-4 py-2 bg-sky-300 text-sky-900 rounded hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {maintenanceLoading === 'integrity' ? (
                      <div className="w-4 h-4 border-2 border-sky-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MagnifyingGlassIcon className="w-5 h-5" />
                    )}
                    Check Integrity
                  </button>
                </div>
              </div>

              {integrityResult && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h5 className="font-medium text-green-800 mb-2">Integrity Check Result</h5>
                  <pre className="text-sm text-green-700 whitespace-pre-wrap">{integrityResult}</pre>
                </div>
              )}

              {maintenanceLoading && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-sm text-blue-700">
                    {maintenanceLoading === 'export' && 'Exporting table data...'}
                    {maintenanceLoading === 'backup' && 'Creating database backup...'}
                    {maintenanceLoading === 'integrity' && 'Running integrity check...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



