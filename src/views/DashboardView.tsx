import React from 'react';
import { 
  Plus, 
  ArrowRight, 
  Database, 
  CheckCheck, 
  Sliders, 
  Trash2,
  Layers
} from 'lucide-react';
import type { Dataset, ActivityItem } from '../types';
import type { GlobalMetrics } from '../services/store';
import type { NavTab } from '../components/Sidebar';

interface DashboardViewProps {
  metrics: GlobalMetrics;
  datasets: Omit<Dataset, 'records'>[];
  activities: ActivityItem[];
  onSelectTab: (tab: NavTab) => void;
  onOpenDataset: (id: string) => void;
  onDeleteDataset: (id: string) => void;
  onLoadDemoData: () => void;
  isLoadingDemo: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  datasets,
  activities,
  onSelectTab,
  onOpenDataset,
  onDeleteDataset,
  onLoadDemoData,
  isLoadingDemo
}) => {
  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back</h1>
          <p className="page-subtitle">
            Generate, validate, and stress-test synthetic data with deterministic seed control and statistical precision.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {datasets.length === 0 && (
            <button 
              className="btn btn-secondary"
              onClick={onLoadDemoData}
              disabled={isLoadingDemo}
              title="Populate an initial demo dataset strictly labeled as DEMO DATA"
            >
              <Database size={14} />
              <span>{isLoadingDemo ? 'Generating Demo...' : 'Load DEMO DATA'}</span>
            </button>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => onSelectTab('create_dataset')}
          >
            <Plus size={14} />
            <span>Create Dataset</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Strictly from real database) */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">
            <span>Datasets</span>
            <Layers size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="metric-value">{metrics.totalDatasets}</div>
          <div className="metric-meta">Active persistent schemas</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Rows Generated</span>
            <Database size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="metric-value">{metrics.totalRowsGenerated.toLocaleString()}</div>
          <div className="metric-meta">Synthesized records in storage</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Validation Pass Rate</span>
            <CheckCheck size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="metric-value">
            {metrics.totalDatasets > 0 ? `${metrics.validationPassRate}%` : '—'}
          </div>
          <div className="metric-meta">Across all statistical invariants</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Anomalies Injected</span>
            <Sliders size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="metric-value">{metrics.totalAnomaliesInjected.toLocaleString()}</div>
          <div className="metric-meta">Tracked in audit logs</div>
        </div>
      </div>

      {/* Recent Datasets Table */}
      <div className="table-container" style={{ marginBottom: '24px' }}>
        <div className="table-header-bar">
          <div className="table-title">Recent Datasets</div>
          {datasets.length > 0 && (
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => onSelectTab('datasets')}
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {datasets.length === 0 ? (
          <div className="empty-state-box">
            <Database className="empty-state-icon" />
            <div className="empty-state-title">No datasets yet</div>
            <p className="empty-state-text">
              Create your first controlled synthetic dataset from a natural-language requirement.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => onSelectTab('create_dataset')}
              >
                <Plus size={14} />
                <span>Create Dataset</span>
              </button>
              <button 
                className="btn btn-secondary"
                onClick={onLoadDemoData}
                disabled={isLoadingDemo}
              >
                <span>{isLoadingDemo ? 'Generating...' : 'Load DEMO DATA'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Domain</th>
                  <th>Rows</th>
                  <th>Validation</th>
                  <th>Anomalies</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.slice(0, 5).map((ds) => {
                  const passRate = ds.validationReport?.complianceRate ?? 0;
                  const isPassed = ds.validationReport?.overallStatus === 'PASSED';
                  const isWarning = ds.validationReport?.overallStatus === 'WARNING';
                  const anomalyCount = ds.anomalyLogs?.length ?? 0;

                  return (
                    <tr key={ds.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div 
                          style={{ cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                          onClick={() => onOpenDataset(ds.id)}
                        >
                          <span>{ds.name}</span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            [{ds.seed}]
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                          {ds.domain}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {ds.rowCount.toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${isPassed ? 'badge-success' : (isWarning ? 'badge-warning' : 'badge-danger')}`}>
                          {ds.validationReport?.overallStatus ?? 'UNVALIDATED'} ({passRate}%)
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {anomalyCount.toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {new Date(ds.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenDataset(ds.id)}
                            title="Inspect Dataset"
                          >
                            <span>Inspect</span>
                          </button>
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => onDeleteDataset(ds.id)}
                            title="Delete Dataset"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="table-container">
        <div className="table-header-bar">
          <div className="table-title">Recent Activity</div>
        </div>

        {activities.length === 0 ? (
          <div className="empty-state-box" style={{ padding: '32px' }}>
            <div className="empty-state-title" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              No audit activities recorded yet.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Target</th>
                <th>Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {activities.slice(0, 8).map((act) => (
                <tr key={act.id}>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                      {act.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {act.target}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {act.details}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
