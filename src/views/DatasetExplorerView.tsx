import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  AlertCircle,
  Database,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import type { Dataset, DatasetRecord } from '../types';
import { exportDatasetToCsv } from '../services/exporter';
import { downloadCloudDatasetCsv } from '../services/supabaseService';

interface DatasetExplorerViewProps {
  dataset: Dataset | null;
  onGoToCreate: () => void;
  onRetryCloudSave?: (dataset: Dataset) => void;
  isSyncingCloud?: boolean;
}

export const DatasetExplorerView: React.FC<DatasetExplorerViewProps> = ({
  dataset,
  onGoToCreate,
  onRetryCloudSave,
  isSyncingCloud
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anomalyFilter, setAnomalyFilter] = useState<'ALL' | 'ANOMALIES_ONLY' | 'CLEAN_ONLY'>('ALL');
  const [sortField, setSortField] = useState<string>('_rowId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [inspectedRow, setInspectedRow] = useState<DatasetRecord | null>(null);

  // Column visibility state
  const allColumns = useMemo(() => {
    if (!dataset) return [];
    return dataset.specification.schema.map(c => c.name);
  }, [dataset]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  // Initialize visible columns when dataset loads
  React.useEffect(() => {
    if (dataset) {
      setVisibleColumns(dataset.specification.schema.map(c => c.name));
    }
  }, [dataset?.id]);

  // Filtered and sorted rows
  const processedRows = useMemo(() => {
    if (!dataset || !dataset.records) return [];

    let result = dataset.records;

    // Filter by anomaly status
    if (anomalyFilter === 'ANOMALIES_ONLY') {
      result = result.filter(r => r._hasAnomaly);
    } else if (anomalyFilter === 'CLEAN_ONLY') {
      result = result.filter(r => !r._hasAnomaly);
    }

    // Search filter across visible fields
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row => {
        return allColumns.some(col => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
        });
      });
    }

    // Sort rows
    result = [...result].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [dataset, anomalyFilter, searchTerm, sortField, sortDirection, allColumns]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, currentPage, pageSize]);

  const handleSort = (colName: string) => {
    if (sortField === colName) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(colName);
      setSortDirection('asc');
    }
  };

  if (!dataset) {
    return (
      <div className="page-container">
        <div className="empty-state-box" style={{ marginTop: '60px' }}>
          <Database className="empty-state-icon" />
          <div className="empty-state-title">No dataset loaded</div>
          <p className="empty-state-text">
            Generate a synthetic dataset to explore records, filter edge cases, and inspect row-level anomalies.
          </p>
          <button className="btn btn-primary" onClick={onGoToCreate} style={{ marginTop: '12px' }}>
            <span>Create Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title">{dataset.name}</h1>
            <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              Seed: {dataset.seed}
            </span>

            {/* Cloud Status Badge */}
            {dataset.cloudStatus === 'CLOUD_SAVED' ? (
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                  color: '#10b981', 
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title={`Synced to Supabase Cloud\nCloud ID: ${dataset.cloudDatasetId || 'Active'}`}
              >
                <Cloud size={12} />
                <span>☁ Cloud Saved</span>
              </span>
            ) : dataset.cloudStatus === 'SYNCING' || isSyncingCloud ? (
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                  color: '#3b82f6', 
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <RefreshCw size={12} className="spin-animate" />
                <span>Syncing to Supabase...</span>
              </span>
            ) : dataset.cloudStatus === 'SYNC_FAILED' ? (
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                  color: '#ef4444', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title={dataset.cloudError || 'Cloud persistence failed'}
              >
                <CloudOff size={12} />
                <span>Sync Failed</span>
              </span>
            ) : (
              <span 
                className="badge badge-neutral"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Stored locally in client IndexedDB"
              >
                <span>💾 Local Storage</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span><strong>{dataset.rowCount.toLocaleString()}</strong> rows</span>
            <span>•</span>
            <span><strong>{dataset.specification.schema.length}</strong> columns</span>
            <span>•</span>
            <span>Domain: <strong style={{ textTransform: 'capitalize' }}>{dataset.domain}</strong></span>
            <span>•</span>
            <span>Generation duration: <strong>{dataset.generationDurationMs}ms</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Cloud Storage CSV Download Button */}
          {dataset.cloudStoragePath && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCloudDatasetCsv(dataset.cloudStoragePath!, `${dataset.name}_supabase.csv`)}
              title="Download CSV asset directly from Supabase Storage"
            >
              <Cloud size={13} />
              <span>Cloud CSV</span>
            </button>
          )}

          {/* Sync / Retry Save to Supabase Button */}
          {onRetryCloudSave && dataset.cloudStatus !== 'CLOUD_SAVED' && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onRetryCloudSave(dataset)}
              disabled={isSyncingCloud || dataset.cloudStatus === 'SYNCING'}
              title="Persist schema, dataset rows (in batches of 500), and audit files to Supabase"
            >
              <RefreshCw size={13} className={isSyncingCloud || dataset.cloudStatus === 'SYNCING' ? 'spin-animate' : ''} />
              <span>{isSyncingCloud || dataset.cloudStatus === 'SYNCING' ? 'Syncing...' : 'Sync to Supabase'}</span>
            </button>
          )}

          <button 
            className="btn btn-primary btn-sm"
            onClick={() => exportDatasetToCsv(dataset)}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div 
        style={{ 
          backgroundColor: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-md)', 
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-text"
              placeholder="Search table values..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '32px', height: '32px', fontSize: '12px' }}
            />
          </div>

          {/* Anomaly Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter:</span>
            <select
              className="input-select"
              value={anomalyFilter}
              onChange={(e) => {
                setAnomalyFilter(e.target.value as any);
                setPage(1);
              }}
              style={{ height: '32px', fontSize: '12px', width: 'auto', padding: '4px 8px' }}
            >
              <option value="ALL">All Records ({dataset.rowCount.toLocaleString()})</option>
              <option value="ANOMALIES_ONLY">Anomalies Only ({dataset.anomalyLogs.length.toLocaleString()})</option>
              <option value="CLEAN_ONLY">Clean Baseline Records</option>
            </select>
          </div>
        </div>

        {/* Column Visibility & Pagination Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rows / Page:</span>
            <select
              className="input-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              style={{ height: '32px', fontSize: '12px', width: 'auto', padding: '4px 8px' }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            Showing {((currentPage - 1) * pageSize + 1).toLocaleString()} - {Math.min(currentPage * pageSize, processedRows.length).toLocaleString()} of {processedRows.length.toLocaleString()}
          </span>

          {/* Pagination Buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '4px 8px', height: '32px' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '4px 8px', height: '32px' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Table with Sticky Header */}
      <div 
        className="table-container"
        style={{ 
          maxHeight: '600px', 
          overflowY: 'auto',
          border: '1px solid var(--border)',
          position: 'relative'
        }}
      >
        <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>#</th>
              <th style={{ width: '90px' }}>Status</th>
              {allColumns.map(col => {
                if (!visibleColumns.includes(col)) return null;
                return (
                  <th 
                    key={col} 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort(col)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{col}</span>
                      <ArrowUpDown size={11} style={{ opacity: sortField === col ? 1 : 0.3 }} />
                    </div>
                  </th>
                );
              })}
              <th style={{ width: '60px', textAlign: 'right' }}>View</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No records match current filter criteria.
                </td>
              </tr>
            ) : (
              paginatedRows.map(row => {
                return (
                  <tr 
                    key={row._rowId}
                    style={{ 
                      backgroundColor: row._hasAnomaly ? 'rgba(239, 68, 68, 0.04)' : undefined
                    }}
                  >
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {row._rowId}
                    </td>
                    <td>
                      {row._hasAnomaly ? (
                        <span 
                          className="badge badge-danger" 
                          style={{ fontSize: '10px', padding: '1px 5px', cursor: 'pointer' }}
                          title={`Injected Anomaly: ${row._anomalyTypes.join(', ')}`}
                          onClick={() => setInspectedRow(row)}
                        >
                          ANOMALY
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          BASE
                        </span>
                      )}
                    </td>

                    {allColumns.map(col => {
                      if (!visibleColumns.includes(col)) return null;
                      const val = row[col];
                      const isNull = val === null || val === undefined;

                      return (
                        <td key={col} style={{ fontFamily: typeof val === 'number' ? 'var(--font-mono)' : 'inherit' }}>
                          {isNull ? (
                            <span style={{ color: 'var(--warning)', fontStyle: 'italic', fontSize: '11px' }}>null</span>
                          ) : typeof val === 'boolean' ? (
                            <span className={`badge ${val ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                              {String(val)}
                            </span>
                          ) : typeof val === 'number' && col.includes('amount') ? (
                            <span>${val.toFixed(2)}</span>
                          ) : (
                            <span style={{ fontSize: '12px' }}>{String(val)}</span>
                          )}
                        </td>
                      );
                    })}

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px' }}
                        onClick={() => setInspectedRow(row)}
                        title="Inspect full row JSON"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Row Inspection Side Drawer */}
      {inspectedRow && (
        <div className="drawer-backdrop" onClick={() => setInspectedRow(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  Record #{inspectedRow._rowId} Details
                </span>
                {inspectedRow._hasAnomaly ? (
                  <span className="badge badge-danger">ANOMALY DETECTED</span>
                ) : (
                  <span className="badge badge-neutral">VALIDATED BASELINE</span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setInspectedRow(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="drawer-body">
              {inspectedRow._hasAnomaly && (
                <div 
                  style={{ 
                    backgroundColor: 'var(--danger-subtle)', 
                    border: '1px solid var(--danger-border)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 600, fontSize: '12px' }}>
                    <AlertCircle size={14} />
                    <span>Injected Edge Case: {inspectedRow._anomalyTypes.join(', ')}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    This row was mutated during the edge-case generation phase to test downstream resilience.
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Row Schema Attributes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allColumns.map(col => {
                    const val = inspectedRow[col];
                    return (
                      <div 
                        key={col}
                        style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          padding: '8px 12px', 
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {col}
                        </span>
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {val === null ? '<null>' : String(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Raw JSON Payload
                </div>
                <pre 
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    padding: '12px', 
                    borderRadius: 'var(--radius-sm)', 
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    overflowX: 'auto',
                    border: '1px solid var(--border)'
                  }}
                >
                  {JSON.stringify(inspectedRow, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
