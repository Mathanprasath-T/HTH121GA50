import React from 'react';
import { 
  CheckCheck, 
  AlertTriangle, 
  Download, 
  BarChart2, 
  Sliders, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { Dataset } from '../types';
import { exportValidationReportJson, exportValidationReportMarkdown } from '../services/exporter';

interface ValidationViewProps {
  dataset: Dataset | null;
  onSelectDatasetTab: () => void;
}

export const ValidationView: React.FC<ValidationViewProps> = ({
  dataset,
  onSelectDatasetTab
}) => {
  if (!dataset) {
    return (
      <div className="page-container">
        <div className="empty-state-box" style={{ marginTop: '60px' }}>
          <CheckCheck className="empty-state-icon" />
          <div className="empty-state-title">No active dataset selected</div>
          <p className="empty-state-text">
            Generate or select a dataset to inspect its statistical validation measurements and distribution fidelity.
          </p>
          <button className="btn btn-primary" onClick={onSelectDatasetTab} style={{ marginTop: '12px' }}>
            <span>Go to Datasets</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const report = dataset.validationReport;
  const isPassed = report.overallStatus === 'PASSED';
  const isWarning = report.overallStatus === 'WARNING';

  // Extract statistical metrics
  const stats = report.statisticalMetrics;
  const weekendCount = stats.weekendTransactions || 0;
  const weekdayCount = stats.weekdayTransactions || 0;
  const totalDaysSampled = weekendCount + weekdayCount;
  const weekendPct = totalDaysSampled > 0 ? Math.round((weekendCount / totalDaysSampled) * 100) : 0;
  const weekdayPct = 100 - weekendPct;

  // Anomalies by type
  const anomalyEntries = Object.entries(stats.anomaliesByType || {});
  const totalAnomalies = anomalyEntries.reduce((sum, [, count]) => sum + count, 0);

  // Missing values by column
  const nullEntries = Object.entries(stats.nullCountByColumn || {}).filter(([, c]) => c > 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Validation Report</h1>
            <span 
              className={`badge ${isPassed ? 'badge-success' : (isWarning ? 'badge-warning' : 'badge-danger')}`}
              style={{ fontSize: '12px', padding: '3px 10px', fontWeight: 600 }}
            >
              {report.overallStatus}
            </span>
          </div>
          <p className="page-subtitle">
            Rigorous statistical comparison of target parameters against actual measurements for dataset{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{dataset.name}</code>{' '}
            ({dataset.rowCount.toLocaleString()} rows, Seed: {dataset.seed}).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportValidationReportJson(report, dataset.name)}
          >
            <Download size={13} />
            <span>JSON Audit</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportValidationReportMarkdown(report, dataset)}
          >
            <Download size={13} />
            <span>Markdown Audit</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
        <div className="metric-card">
          <div className="metric-label">Compliance Rate</div>
          <div className="metric-value" style={{ color: isPassed ? 'var(--success)' : (isWarning ? 'var(--warning)' : 'var(--danger)') }}>
            {report.complianceRate}%
          </div>
          <div className="metric-meta">{report.passedChecks} of {report.totalChecks} invariant checks passed</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Sample Mean Amount</div>
          <div className="metric-value">
            ${stats.meanAmount ? stats.meanAmount.toLocaleString() : 'N/A'}
          </div>
          <div className="metric-meta">Std Dev: ±${stats.stdDevAmount?.toLocaleString() ?? 0}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Extreme Outliers Detected</div>
          <div className="metric-value">
            {stats.anomaliesByType?.['EXTREME_VALUE'] ?? 0}
          </div>
          <div className="metric-meta">Values exceeding 4.5σ IQR boundary</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Audit Invariant Status</div>
          <div className="metric-value" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPassed ? (
              <>
                <CheckCheck size={18} style={{ color: 'var(--success)' }} />
                <span>Deterministic Zero-Drift</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                <span>Tolerance Exceeded</span>
              </>
            )}
          </div>
          <div className="metric-meta">Validated at {new Date(report.validatedAt).toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Target vs Actual Measurement Table (Core Requirement 14) */}
      <div className="table-container" style={{ marginBottom: '24px' }}>
        <div className="table-header-bar">
          <div className="table-title">Requirement vs Actual Measurements</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Tolerance bands evaluated deterministically
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Requirement</th>
                <th style={{ textAlign: 'center', width: '12%' }}>Target</th>
                <th style={{ textAlign: 'center', width: '12%' }}>Actual</th>
                <th style={{ textAlign: 'center', width: '12%' }}>Deviation</th>
                <th style={{ textAlign: 'center', width: '12%' }}>Tolerance</th>
                <th style={{ textAlign: 'right', width: '14%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((chk) => {
                const isCheckPass = chk.status === 'PASS';
                const isCheckWarn = chk.status === 'WARNING';
                const devSign = chk.deviation > 0 ? `+${chk.deviation}` : `${chk.deviation}`;

                return (
                  <tr key={chk.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {chk.metric}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {chk.description}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                      {chk.target}{chk.unit}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {chk.actual}{chk.unit}
                    </td>
                    <td 
                      style={{ 
                        textAlign: 'center', 
                        fontFamily: 'var(--font-mono)',
                        color: chk.deviation === 0 ? 'var(--text-muted)' : (isCheckPass ? 'var(--text-secondary)' : 'var(--danger)')
                      }}
                    >
                      {devSign}{chk.unit}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      ±{chk.tolerance}{chk.unit}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span 
                        className={`badge ${isCheckPass ? 'badge-success' : (isCheckWarn ? 'badge-warning' : 'badge-danger')}`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {chk.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visualizations Grid (Section 15: Charts with purpose) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Chart 1: Weekend vs Weekday Distribution */}
        <div className="section-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
                Weekend vs Weekday Volume Comparison
              </span>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
              +{dataset.specification.edgeCases.weekendSalesIncrease}% Target
            </span>
          </div>
          <p className="section-card-desc" style={{ marginBottom: '16px' }}>
            Evaluates cyclicality shift applied between Monday–Friday and Saturday–Sunday.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Weekend (Sat &amp; Sun)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {weekendCount.toLocaleString()} rows ({weekendPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${weekendPct}%`, height: '100%', backgroundColor: 'var(--accent-primary)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Weekday (Mon - Fri)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {weekdayCount.toLocaleString()} rows ({weekdayPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${weekdayPct}%`, height: '100%', backgroundColor: 'var(--info)' }} />
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Normalized daily run rate: Weekend days generate{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {Math.round(weekendCount / 2).toLocaleString()} rows/day
              </strong>{' '}
              vs weekdays{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {Math.round(weekdayCount / 5).toLocaleString()} rows/day
              </strong>.
            </div>
          </div>
        </div>

        {/* Chart 2: Anomalies by Type */}
        <div className="section-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
                Anomalies by Controlled Type
              </span>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
              {totalAnomalies} Total Injected
            </span>
          </div>
          <p className="section-card-desc" style={{ marginBottom: '16px' }}>
            Distribution of intentional anomalies recorded in the immutable audit log.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {anomalyEntries.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
                No anomalies registered in dataset logs.
              </div>
            ) : (
              anomalyEntries.map(([type, count]) => {
                const pct = totalAnomalies > 0 ? Math.round((count / totalAnomalies) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                        {type}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {count.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${pct}%`, 
                          height: '100%', 
                          backgroundColor: type === 'FRAUD_INJECTION' ? 'var(--danger)' : (type === 'EXTREME_VALUE' ? 'var(--warning)' : 'var(--accent-primary)')
                        }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 3: Missing Values by Column */}
        <div className="section-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
                Missing Values by Column (Null Dropout)
              </span>
            </div>
          </div>
          <p className="section-card-desc" style={{ marginBottom: '16px' }}>
            Target missing value rate: {dataset.specification.edgeCases.missingValuesRate}% across nullable schema attributes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {nullEntries.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
                Zero null values detected across schema.
              </div>
            ) : (
              nullEntries.map(([col, count]) => {
                const nullPct = round2((count / dataset.rowCount) * 100);
                return (
                  <div key={col}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                        {col}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {count.toLocaleString()} nulls ({nullPct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, nullPct * 10)}%`, height: '100%', backgroundColor: 'var(--warning)' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 4: Numerical Range & Statistical Moments */}
        <div className="section-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0, fontSize: '14px' }}>
                Numerical Boundaries &amp; IQR Spread
              </span>
            </div>
          </div>
          <p className="section-card-desc" style={{ marginBottom: '16px' }}>
            Empirical range bounds across primary quantitative metric ({dataset.domain === 'ecommerce' ? 'amount' : dataset.domain === 'fintech' ? 'amount' : 'telemetry'}).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Minimum</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px' }}>
                ${stats.minAmount?.toLocaleString() ?? 0}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Maximum (Outlier Peak)</div>
              <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>
                ${stats.maxAmount?.toLocaleString() ?? 0}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Arithmetic Mean</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px' }}>
                ${stats.meanAmount?.toLocaleString() ?? 0}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Standard Deviation (σ)</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px' }}>
                ±${stats.stdDevAmount?.toLocaleString() ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}
