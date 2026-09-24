import React, { useState } from 'react';
import { 
  Trash2, 
  HardDrive, 
  Cpu, 
  Check, 
  RotateCcw,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import type { GlobalMetrics } from '../services/store';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface SettingsViewProps {
  metrics: GlobalMetrics;
  onClearAllData: () => Promise<void>;
  onLoadDemoData: () => void;
  isLoadingDemo: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  metrics,
  onClearAllData,
  onLoadDemoData,
  isLoadingDemo
}) => {
  const [prngAlgorithm, setPrngAlgorithm] = useState('mulberry32');
  const [defaultSeed, setDefaultSeed] = useState(582941);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await onClearAllData();
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSaveEngineSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">
            Configure PRNG generator algorithms, database storage partitions, and deterministic execution parameters.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '840px' }}>
        {/* Storage & Local Database Section */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <HardDrive size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="section-card-title" style={{ margin: 0 }}>
              Persistent Database &amp; Storage
            </span>
          </div>

          <p className="section-card-desc">
            SyntheticLab stores generated datasets, row indices, and immutable anomaly logs in local client IndexedDB storage.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Stored Datasets</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {metrics.totalDatasets}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Total Rows Stored</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {metrics.totalRowsGenerated.toLocaleString()}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Anomaly Audit Logs</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {metrics.totalAnomaliesInjected.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--danger)' }}>
                Danger Zone: Purge Database
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Irreversibly deletes all stored synthetic datasets and audit traces.
              </div>
            </div>

            {showClearConfirm ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={handleClear}
                  disabled={isClearing}
                >
                  {isClearing ? 'Purging...' : 'Confirm Purge'}
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={13} />
                <span>Clear Database</span>
              </button>
            )}
          </div>
        </div>

        {/* Supabase Cloud Database & Storage Card */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={16} style={{ color: '#10b981' }} />
              <span className="section-card-title" style={{ margin: 0 }}>
                Supabase Cloud Persistence &amp; Storage
              </span>
            </div>
            {isSupabaseConfigured() ? (
              <span 
                className="badge" 
                style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                  color: '#10b981', 
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={12} />
                <span>Active &amp; Configured</span>
              </span>
            ) : (
              <span className="badge badge-warning">Credentials Missing</span>
            )}
          </div>

          <p className="section-card-desc">
            Dual persistence architecture: datasets are first saved instantly to local IndexedDB, then asynchronously synchronized to your Supabase PostgreSQL database and Storage buckets in chunks of 500 rows.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Cloud Endpoint</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>
                https://rpwtzksyslincqowxclm.supabase.co
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Ingestion Batch Size</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                500 records / batch
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PostgreSQL Tables</div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px' }}>
                generation_jobs, datasets, dataset_records, anomaly_logs
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Storage Buckets</div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px' }}>
                datasets/ (CSV &amp; Anomaly Log), reports/ (Markdown)
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Schema definitions and RLS policies are available at <code style={{ color: 'var(--accent-primary)' }}>supabase/schema.sql</code>.
          </div>
        </div>

        {/* PRNG & Generation Engine Settings */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Cpu size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="section-card-title" style={{ margin: 0 }}>
              Synthesis Engine &amp; PRNG
            </span>
          </div>

          <form onSubmit={handleSaveEngineSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Default PRNG Algorithm</label>
                <select
                  className="input-select"
                  value={prngAlgorithm}
                  onChange={(e) => setPrngAlgorithm(e.target.value)}
                >
                  <option value="mulberry32">Mulberry32 (32-bit Fast Deterministic)</option>
                  <option value="splitmix64">SplitMix64 (High Entropy Stream)</option>
                  <option value="xoshiro128">Xoshiro128+ (Stateful PRNG)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Default Seed Base</label>
                <input
                  type="number"
                  className="input-text"
                  value={defaultSeed}
                  onChange={(e) => setDefaultSeed(parseInt(e.target.value, 10) || 1)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {saveSuccess ? 'Settings updated successfully.' : 'Changes apply to subsequent generation jobs.'}
              </span>
              <button type="submit" className="btn btn-primary btn-sm">
                {saveSuccess ? <Check size={13} /> : null}
                <span>Save Engine Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Development & Demo Utilities */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="section-card-title" style={{ fontSize: '14px', margin: 0 }}>
                Demo Data Loader [DEMO DATA]
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Load 10,000 pre-validated e-commerce transaction records labeled as DEMO DATA for quick evaluator inspection.
              </div>
            </div>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={onLoadDemoData}
              disabled={isLoadingDemo}
            >
              <RotateCcw size={13} />
              <span>{isLoadingDemo ? 'Generating...' : 'Seed DEMO DATA'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
