import React from 'react';
import { 
  LayoutDashboard, 
  FileCode2, 
  Database, 
  CheckCheck, 
  Sliders, 
  Zap, 
  FileText, 
  Settings, 
  HardDrive
} from 'lucide-react';

export type NavTab = 
  | 'dashboard'
  | 'create_dataset'
  | 'specification_review'
  | 'datasets'
  | 'validation'
  | 'anomaly_lab'
  | 'stress_test'
  | 'reports'
  | 'settings'
  | 'landing';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  datasetCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  datasetCount
}) => {
  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <div 
          className="brand-wrapper" 
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('dashboard')}
        >
          <div className="brand-logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="3" rx="1" fill="#6366F1" />
              <rect x="3" y="10.5" width="11" height="3" rx="1" fill="#9CA3AF" />
              <rect x="17" y="10.5" width="4" height="3" rx="1" fill="#22C55E" />
              <rect x="3" y="17" width="18" height="3" rx="1" fill="#38BDF8" />
            </svg>
          </div>
          <span className="brand-title">SyntheticLab</span>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="workspace-badge">
        <div className="workspace-name">
          <HardDrive size={13} style={{ color: 'var(--text-muted)' }} />
          <span>prod-cluster-01</span>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>v2.4</span>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        <div 
          className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <LayoutDashboard className="nav-icon" />
          <span>Dashboard</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'create_dataset' || currentTab === 'specification_review' ? 'active' : ''}`}
          onClick={() => onSelectTab('create_dataset')}
        >
          <FileCode2 className="nav-icon" />
          <span>Generate Dataset</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'datasets' ? 'active' : ''}`}
          onClick={() => onSelectTab('datasets')}
        >
          <Database className="nav-icon" />
          <span style={{ flex: 1 }}>Datasets</span>
          {datasetCount > 0 && (
            <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
              {datasetCount}
            </span>
          )}
        </div>

        <div 
          className={`nav-item ${currentTab === 'validation' ? 'active' : ''}`}
          onClick={() => onSelectTab('validation')}
        >
          <CheckCheck className="nav-icon" />
          <span>Validation</span>
        </div>

        <div className="nav-section-title">Testing</div>

        <div 
          className={`nav-item ${currentTab === 'anomaly_lab' ? 'active' : ''}`}
          onClick={() => onSelectTab('anomaly_lab')}
        >
          <Sliders className="nav-icon" />
          <span>Anomaly Lab</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'stress_test' ? 'active' : ''}`}
          onClick={() => onSelectTab('stress_test')}
        >
          <Zap className="nav-icon" />
          <span>Stress Test</span>
        </div>

        <div className="nav-section-title">Audit</div>

        <div 
          className={`nav-item ${currentTab === 'reports' ? 'active' : ''}`}
          onClick={() => onSelectTab('reports')}
        >
          <FileText className="nav-icon" />
          <span>Reports</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <Settings className="nav-icon" />
          <span>Settings</span>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div 
          className="engine-status-pill"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('landing')}
          title="Click to view product introduction"
        >
          <span className="status-dot-green"></span>
          <span style={{ flex: 1 }}>Engine v2.4.1</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>PROD</span>
        </div>

        <div className="user-profile-row">
          <div className="user-avatar">KA</div>
          <div className="user-meta">
            <span className="user-name">kiruthika</span>
            <span className="user-role">Staff Data Engineer</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
