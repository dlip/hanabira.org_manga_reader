'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface TableRow {
  // Dynamic shape: string keys to unknown values
  [key: string]: unknown;
}

interface SchemaResponse {
  success: boolean;
  error?: string;
  schema?: Record<string, unknown>;
}

interface TableResponse {
  success: boolean;
  data: TableRow[];
  table: string;
  pagination: {
    page: number;
    per_page: number;
    total_rows: number;
    total_pages: number;
  };
}

export default function DatabasePage() {
  const [tables, setTables] = useState<Record<string, TableRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllTables();
  }, []);

  const fetchAllTables = async () => {
    try {
      // First get the schema to know which tables exist
      const schemaResponse = await fetch(`${API_BASE_URL}/admin/database/schema`);
      const schemaResult: SchemaResponse = await schemaResponse.json();
      
      if (!schemaResult.success || !schemaResult.schema) {
        setError(schemaResult.error ?? 'Failed to load schema');
        return;
      }

      const tableNames = Object.keys(schemaResult.schema || {});
  const allTables: Record<string, TableRow[]> = {};

      // Fetch data for each table
      for (const tableName of tableNames) {
  const tableResponse = await fetch(`${API_BASE_URL}/admin/database/table/${tableName}?page=1&per_page=1000`);
  const tableResult: TableResponse = await tableResponse.json();
        
        if (tableResult.success) {
          allTables[tableName] = tableResult.data;
        }
      }

      setTables(allTables);
    } catch (err) {
      setError(`Failed to fetch database: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: unknown) => {
    if (value === null) return 'NULL';
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 xl:p-6 2xl:p-8">
      <div className="mx-auto max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1900px]">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Database Contents</h1>
            <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
          </div>
          <p className="text-gray-600 mt-1">Complete view of all database tables and records</p>
        </header>

        <div className="space-y-8">
          {Object.entries(tables).map(([tableName, rows]) => (
            <div key={tableName} className="bg-white rounded-lg shadow-sm border">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">{tableName}</h2>
                <p className="text-sm text-gray-600">{rows.length} records</p>
              </div>
              
              {rows.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No records in this table
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(rows[0]).map((column) => (
                          <th key={column} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rows.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                              <div className="truncate" title={String(value)}>
                                {formatValue(value)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}