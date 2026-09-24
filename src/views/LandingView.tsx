import React from 'react';
import { 
  ArrowRight, 
  Database
} from 'lucide-react';
import type { NavTab } from '../components/Sidebar';

interface LandingViewProps {
  onSelectTab: (tab: NavTab) => void;
  onLoadDemoData: () => void;
  isLoadingDemo: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSelectTab,
  onLoadDemoData,
  isLoadingDemo
}) => {
  return (
    <div className="page-container" style={{ maxWidth: '1080px', paddingTop: '48px', paddingBottom: '80px' }}>
      {/* Hero Section (Restrained, Direct, Engineering-Oriented) */}
      <div style={{ textAlign: 'left', marginBottom: '40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          <span className="status-dot-green"></span>
          <span>SyntheticLab Engine v2.4.1</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>Deterministic Seed Locking</span>
        </div>

        <h1 style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: '1.15', color: 'var(--text-primary)', marginBottom: '16px' }}>
          Generate synthetic data.<br />
          Control every edge case.<br />
          Prove it works.
        </h1>

        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: '1.6', marginBottom: '24px' }}>
          Describe your dataset in natural language. Generate reproducible synthetic data, inject controlled edge cases, and verify the result with statistical validation.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => onSelectTab('create_dataset')}
            style={{ padding: '8px 18px', fontSize: '14px' }}
          >
            <span>Create Dataset</span>
            <ArrowRight size={14} />
          </button>

          <button 
            className="btn btn-secondary"
            onClick={onLoadDemoData}
            disabled={isLoadingDemo}
            style={{ padding: '8px 18px', fontSize: '14px' }}
          >
            <Database size={14} />
            <span>{isLoadingDemo ? 'Generating Demo...' : 'View Demo (DEMO DATA)'}</span>
          </button>
        </div>
      </div>

      {/* Engineering Workflow Steps */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '32px',
          alignItems: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Step 1</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Describe</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Natural requirements</div>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--border-focus)' }}>→</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Step 2</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Generate</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>PRNG seed synthesis</div>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--border-focus)' }}>→</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Step 3</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Control</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Anomalies &amp; drift</div>
        </div>
      </div>

      {/* Real Looking Product Architecture Preview Card (Requirement 27) */}
      <div 
        style={{ 
          backgroundColor: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden'
        }}
      >
        <div style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
              syntheticlab-cli validate --seed 582941 --target ecommerce_10k.spec
            </span>
          </div>
          <span className="badge badge-success" style={{ fontSize: '10px' }}>
            PASSED (100% INVARIANTS)
          </span>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Requirement: Fraud Rate</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '4px' }}>Target: 2.00% | Actual: 1.98%</div>
              <div style={{ color: 'var(--success)', fontSize: '11px', marginTop: '2px' }}>PASS (Dev: -0.02% ≤ ±0.15%)</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Requirement: Missing Nulls</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '4px' }}>Target: 2.00% | Actual: 2.01%</div>
              <div style={{ color: 'var(--success)', fontSize: '11px', marginTop: '2px' }}>PASS (Dev: +0.01% ≤ ±0.15%)</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Requirement: Outlier Bounds</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '4px' }}>Target: 1.00% | Actual: 1.02%</div>
              <div style={{ color: 'var(--success)', fontSize: '11px', marginTop: '2px' }}>PASS (Dev: +0.02% ≤ ±0.15%)</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Ready to generate your controllable dataset specification?
            </span>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => onSelectTab('create_dataset')}
            >
              <span>Launch Studio</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
