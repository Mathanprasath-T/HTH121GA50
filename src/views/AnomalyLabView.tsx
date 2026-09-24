import React, { useState } from 'react';
import { 
  Sliders, 
  Play, 
  Download, 
  X 
} from 'lucide-react';
import type { Dataset, AnomalyLog, AnomalySeverity } from '../types';
import { exportAnomalyLogCsv } from '../services/exporter';

interface AnomalyLabViewProps {
  dataset: Dataset | null;
  onApplyAnomalies: (targets: {
    missingRatePct: number;
    extremeRatePct: number;
    duplicateRatePct: number;
    invalidDateRatePct: number;
    rareCategoryRatePct: number;
  }) => Promise<void>;
  isApplying: boolean;
  onGoToCreate: () => void;
}

export const AnomalyLabView: React.FC<AnomalyLabViewProps> = ({
  dataset,
  onApplyAnomalies,
  isApplying,
  onGoToCreate
}) => {
  const [missingRate, setMissingRate] = useState<number>(2.0);
  const [extremeRate, setExtremeRate] = useState<number>(1.0);
  const [duplicateRate, setDuplicateRate] = useState<number>(0.2);
  const [invalidDateRate, setInvalidDateRate] = useState<number>(0.1);
  const [rareCategoryRate, setRareCategoryRate] = useState<number>(0.5);

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyLog | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  if (!dataset) {
    return (
      <div className="page-container">
        <div className="empty-state-box" style={{ marginTop: '60px' }}>
          <Sliders className="empty-state-icon" />
          <div className="empty-state-title">No dataset selected for Anomaly Lab</div>
          <p className="empty-state-text">
            Select or generate a dataset to inject controlled edge cases and inspect the engineering audit log.
          </p>
          <button className="btn btn-primary" onClick={onGoToCreate} style={{ marginTop: '12px' }}>
            <span>Create Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  const totalRows = dataset.rowCount;

  const handleApply = async () => {
    await onApplyAnomalies({
      missingRatePct: missingRate,
      extremeRatePct: extremeRate,
      duplicateRatePct: duplicateRate,
      invalidDateRatePct: invalidDateRate,
      rareCategoryRatePct: rareCategoryRate,
    });
  };

  const logs = dataset.anomalyLogs || [];
  const filteredLogs = typeFilter === 'ALL' 
    ? logs 
    : logs.filter(l => l.type === typeFilter);

  const getSeverityBadgeClass = (sev: AnomalySeverity) => {
    switch (sev) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      case 'LOW': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Anomaly Lab</h1>
            <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              {dataset.name}
            </span>
          </div>
          <p className="page-subtitle">
            Inject controlled edge cases into your dataset and track exactly what changed in the deterministic audit log.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportAnomalyLogCsv(logs, dataset.name)}
            disabled={logs.length === 0}
          >
            <Download size={13} />
            <span>Export Anomaly Log</span>
          </button>
        </div>
      </div>

      {/* Anomaly Controls (Requirement 17) */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
              Edge Case Injection Controls
            </span>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleApply}
            disabled={isApplying}
          >
            <Play size={14} fill="currentColor" />
            <span>{isApplying ? 'Injecting Edge Cases...' : 'Apply Anomalies'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {/* Missing Values */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Missing Values</span>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>LOW</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                className="input-text"
                value={missingRate}
                onChange={(e) => setMissingRate(parseFloat(e.target.value) || 0)}
                style={{ fontFamily: 'var(--font-mono)', padding: '4px 8px', height: '28px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Affected: {Math.round((missingRate / 100) * totalRows).toLocaleString()} rows
            </div>
          </div>

          {/* Extreme Values */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Extreme Values</span>
              <span className="badge badge-warning" style={{ fontSize: '10px' }}>HIGH</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                className="input-text"
                value={extremeRate}
                onChange={(e) => setExtremeRate(parseFloat(e.target.value) || 0)}
                style={{ fontFamily: 'var(--font-mono)', padding: '4px 8px', height: '28px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Affected: {Math.round((extremeRate / 100) * totalRows).toLocaleString()} rows
            </div>
          </div>

          {/* Duplicates */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Duplicates</span>
              <span className="badge badge-danger" style={{ fontSize: '10px' }}>CRITICAL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <input
                type="number"
                step="0.05"
                min="0"
                max="10"
                className="input-text"
                value={duplicateRate}
                onChange={(e) => setDuplicateRate(parseFloat(e.target.value) || 0)}
                style={{ fontFamily: 'var(--font-mono)', padding: '4px 8px', height: '28px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Affected: {Math.round((duplicateRate / 100) * totalRows).toLocaleString()} rows
            </div>
          </div>

          {/* Invalid Dates */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Invalid Dates</span>
              <span className="badge badge-warning" style={{ fontSize: '10px' }}>MEDIUM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <input
                type="number"
                step="0.05"
                min="0"
                max="5"
                className="input-text"
                value={invalidDateRate}
                onChange={(e) => setInvalidDateRate(parseFloat(e.target.value) || 0)}
                style={{ fontFamily: 'var(--font-mono)', padding: '4px 8px', height: '28px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Affected: {Math.round((invalidDateRate / 100) * totalRows).toLocaleString()} rows
            </div>
          </div>

          {/* Rare Categories */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Rare Categories</span>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>LOW</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                className="input-text"
                value={rareCategoryRate}
                onChange={(e) => setRareCategoryRate(parseFloat(e.target.value) || 0)}
                style={{ fontFamily: 'var(--font-mono)', padding: '4px 8px', height: '28px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Affected: {Math.round((rareCategoryRate / 100) * totalRows).toLocaleString()} rows
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Anomaly Log (Requirement 18) */}
      <div className="table-container">
        <div className="table-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="table-title">Engineering Anomaly Log</span>
            <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              {logs.length} Total Injected Anomalies
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter Type:</span>
            <select
              className="input-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
            >
              <option value="ALL">All Types</option>
              <option value="FRAUD_INJECTION">FRAUD_INJECTION</option>
              <option value="EXTREME_VALUE">EXTREME_VALUE</option>
              <option value="MISSING_NULL">MISSING_NULL</option>
              <option value="DUPLICATE_KEY">DUPLICATE_KEY</option>
              <option value="INVALID_DATE">INVALID_DATE</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-title">No anomaly logs found</div>
            <p className="empty-state-text">
              Configure parameters above and click Apply Anomalies to inject controlled edge cases.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ width: '80px' }}>Row ID</th>
                  <th style={{ width: '150px' }}>Type</th>
                  <th style={{ width: '130px' }}>Column</th>
                  <th style={{ width: '140px' }}>Original</th>
                  <th style={{ width: '140px' }}>Injected</th>
                  <th style={{ width: '90px' }}>Severity</th>
                  <th>Reason / Injection Rule</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr 
                    key={log.id} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedAnomaly(log)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      #{log.rowId}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        {log.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.column}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {String(log.originalValue ?? 'null')}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                      {String(log.injectedValue ?? 'null')}
                    </td>
                    <td>
                      <span className={`badge ${getSeverityBadgeClass(log.severity)}`} style={{ fontSize: '10px' }}>
                        {log.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.reason}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnomaly(log);
                        }}
                      >
                        Trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Anomaly Traceability Side Drawer (Requirement 18) */}
      {selectedAnomaly && (
        <div className="drawer-backdrop" onClick={() => setSelectedAnomaly(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  Anomaly Traceability Audit
                </span>
                <span className={`badge ${getSeverityBadgeClass(selectedAnomaly.severity)}`}>
                  {selectedAnomaly.severity}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAnomaly(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Target Mutation Card */}
              <div 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '14px' 
                }}
              >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                  Mutation Delta (Before / After)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: 'var(--surface)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Before (Original)</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {String(selectedAnomaly.originalValue ?? '<null>')}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--danger)' }}>After (Injected)</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--danger)', fontWeight: 600, marginTop: '4px' }}>
                      {String(selectedAnomaly.injectedValue ?? '<null>')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Anomaly Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Traceability Parameters
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Target Row</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                    Row #{selectedAnomaly.rowId}
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Target Column</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                    {selectedAnomaly.column}
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Anomaly Type</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {selectedAnomaly.type}
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dataset ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {selectedAnomaly.datasetId}
                  </span>
                </div>
              </div>

              {/* Why it was injected & Rule formula */}
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                  Why It Was Injected
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  {selectedAnomaly.reason}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                  Injection Rule Formula
                </div>
                <pre style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--info)' }}>
                  {selectedAnomaly.ruleFormula}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
