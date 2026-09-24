import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  Activity, 
  Server, 
  GitBranch, 
  ShieldAlert
} from 'lucide-react';
import type { Dataset, StressTestResult } from '../types';
import { runStressTestSimulation } from '../services/stressTester';
import { store } from '../services/store';

interface StressTestViewProps {
  dataset: Dataset | null;
  onGoToCreate: () => void;
}

export const StressTestView: React.FC<StressTestViewProps> = ({
  dataset,
  onGoToCreate
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<StressTestResult | null>(null);

  if (!dataset) {
    return (
      <div className="page-container">
        <div className="empty-state-box" style={{ marginTop: '60px' }}>
          <Zap className="empty-state-icon" />
          <div className="empty-state-title">No dataset selected for Stress Test</div>
          <p className="empty-state-text">
            Stress-test synthetic data throughput, simulated ML covariate drift, and downstream schema invariant tripwires.
          </p>
          <button className="btn btn-primary" onClick={onGoToCreate} style={{ marginTop: '12px' }}>
            <span>Create Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  const handleRunTest = async (scenario: StressTestResult['scenario']) => {
    setIsRunning(true);
    try {
      const result = await runStressTestSimulation(dataset, scenario);
      store.saveStressTest(result);
      setLastResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const savedTests = store.getStressTests().filter(t => t.datasetId === dataset.id);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Stress Test &amp; Pipeline Resilience</h1>
            <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              {dataset.name}
            </span>
          </div>
          <p className="page-subtitle">
            Simulate downstream ingestion bottlenecks, covariate distribution shifts, and schema tripwires against this dataset.
          </p>
        </div>
      </div>

      {/* Scenario Launcher Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Scenario 1 */}
        <div className="section-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Server size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>High-Load Ingestion</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
              Stress-tests in-memory streaming deserialization rate and p99 latency limits under multi-thread bursts.
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => handleRunTest('HIGH_LOAD_INGESTION')}
            disabled={isRunning}
            style={{ width: '100%' }}
          >
            <Play size={12} fill="currentColor" />
            <span>Run Benchmark</span>
          </button>
        </div>

        {/* Scenario 2 */}
        <div className="section-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <GitBranch size={16} style={{ color: 'var(--info)' }} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Covariate Drift (KS)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
              Kolmogorov-Smirnov two-sample testing across chronological halves to verify distribution stability.
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => handleRunTest('COVARIATE_DRIFT')}
            disabled={isRunning}
            style={{ width: '100%' }}
          >
            <Play size={12} fill="currentColor" />
            <span>Test Drift</span>
          </button>
        </div>

        {/* Scenario 3 */}
        <div className="section-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Schema Invariants</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
              Simulates schema tripwires: malformed dates, out-of-boundary numbers, and type coercions.
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => handleRunTest('SCHEMA_POISONING')}
            disabled={isRunning}
            style={{ width: '100%' }}
          >
            <Play size={12} fill="currentColor" />
            <span>Assert Invariants</span>
          </button>
        </div>

        {/* Scenario 4 */}
        <div className="section-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Activity size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Null Pointer Rigidity</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
              Asserts strict non-nullability on primary keys and identifies nullable column handling paths.
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => handleRunTest('NULL_POINTER_INJECTION')}
            disabled={isRunning}
            style={{ width: '100%' }}
          >
            <Play size={12} fill="currentColor" />
            <span>Verify Nulls</span>
          </button>
        </div>
      </div>

      {/* Active Run Result Panel */}
      {lastResult && (
        <div className="section-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="section-card-title" style={{ margin: 0 }}>
                Test Outcome: {lastResult.scenario.replace(/_/g, ' ')}
              </span>
              <span 
                className={`badge ${lastResult.status === 'PASS' ? 'badge-success' : (lastResult.status === 'WARN' ? 'badge-warning' : 'badge-danger')}`}
                style={{ fontWeight: 600 }}
              >
                {lastResult.status}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Completed at {new Date(lastResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Throughput Rate</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {lastResult.throughputRps.toLocaleString()} rps
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>p99 Latency</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {lastResult.p99LatencyMs} ms
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>KS Drift p-value</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: lastResult.driftPValue >= 0.05 ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
                {lastResult.driftPValue}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invariants Verified</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {lastResult.invariantsPassed} / {lastResult.invariantsTotal}
              </div>
            </div>
          </div>

          {lastResult.failurePoints.length > 0 && (
            <div style={{ backgroundColor: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>
                Identified Vulnerabilities:
              </div>
              <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--text-primary)' }}>
                {lastResult.failurePoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Historical Stress Run Log */}
      <div className="table-container">
        <div className="table-header-bar">
          <div className="table-title">Stress Test Execution History</div>
        </div>

        {savedTests.length === 0 ? (
          <div className="empty-state-box" style={{ padding: '32px' }}>
            <div className="empty-state-title" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              No stress tests executed for this dataset yet. Run a benchmark above.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Status</th>
                <th>Throughput</th>
                <th>p99 Latency</th>
                <th>Invariants</th>
                <th>Executed</th>
              </tr>
            </thead>
            <tbody>
              {savedTests.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {t.scenario}
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'PASS' ? 'badge-success' : 'badge-warning'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {t.throughputRps.toLocaleString()} rps
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {t.p99LatencyMs} ms
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {t.invariantsPassed} / {t.invariantsTotal} passed
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(t.timestamp).toLocaleTimeString()}
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
