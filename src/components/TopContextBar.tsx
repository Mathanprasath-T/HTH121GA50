import React from 'react';
import { 
  Plus, 
  Download, 
  Lock, 
  ChevronRight
} from 'lucide-react';
import type { Dataset } from '../types';
import type { NavTab } from './Sidebar';
import { exportDatasetToCsv } from '../services/exporter';

interface TopContextBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  datasets: Omit<Dataset, 'records'>[];
  activeDatasetId: string | null;
  onSelectActiveDataset: (id: string) => void;
  activeDatasetFull: Dataset | null;
}

export const TopContextBar: React.FC<TopContextBarProps> = ({
  currentTab,
  onSelectTab,
  datasets,
  activeDatasetId,
  onSelectActiveDataset,
  activeDatasetFull
}) => {
  const getTabLabel = (tab: NavTab): string => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'create_dataset': return 'Create Dataset';
      case 'specification_review': return 'Review Specification';
      case 'datasets': return 'Datasets Explorer';
      case 'validation': return 'Validation Suite';
      case 'anomaly_lab': return 'Anomaly Lab';
      case 'stress_test': return 'Stress Testing';
      case 'reports': return 'Reports & Audits';
      case 'settings': return 'Settings';
      case 'landing': return 'Product Overview';
      default: return 'Overview';
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="breadcrumbs">
          <span className="breadcrumb-segment" style={{ cursor: 'pointer' }} onClick={() => onSelectTab('dashboard')}>
            SyntheticLab
          </span>
          <ChevronRight size={13} />
          <span className="breadcrumb-current">
            {getTabLabel(currentTab)}
          </span>
          {activeDatasetFull && (
            <>
              <ChevronRight size={13} />
              <span className="breadcrumb-segment" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {activeDatasetFull.name}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {/* Active Dataset Dropdown Selector */}
        {datasets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dataset:</span>
            <select
              className="input-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
              value={activeDatasetId || ''}
              onChange={(e) => onSelectActiveDataset(e.target.value)}
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.rowCount.toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Deterministic Seed Lock Indicator */}
        {activeDatasetFull && (
          <div className="badge badge-neutral" style={{ height: '28px', gap: '6px' }} title="Deterministic PRNG Seed Lock">
            <Lock size={11} style={{ color: 'var(--accent-primary)' }} />
            <span>Seed: {activeDatasetFull.seed}</span>
          </div>
        )}

        {/* Quick CSV Export */}
        {activeDatasetFull && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportDatasetToCsv(activeDatasetFull)}
            title="Download CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        )}

        {/* New Dataset Action */}
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => onSelectTab('create_dataset')}
        >
          <Plus size={13} />
          <span>New Dataset</span>
        </button>
      </div>
    </header>
  );
};
