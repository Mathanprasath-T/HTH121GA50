import React from 'react';
import { 
  FileText, 
  Download
} from 'lucide-react';
import type { Dataset } from '../types';
import { 
  exportDatasetToCsv, 
  exportSpecificationJson, 
  exportValidationReportMarkdown, 
  exportAnomalyLogCsv 
} from '../services/exporter';

interface ReportsViewProps {
  dataset: Dataset | null;
  onGoToCreate: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  dataset,
  onGoToCreate
}) => {
  if (!dataset) {
    return (
      <div className="page-container">
        <div className="empty-state-box" style={{ marginTop: '60px' }}>
          <FileText className="empty-state-icon" />
          <div className="empty-state-title">No dataset selected for reporting</div>
          <p className="empty-state-text">
            Generate or select a synthetic dataset to view and export the complete engineering documentation package.
          </p>
          <button className="btn btn-primary" onClick={onGoToCreate} style={{ marginTop: '12px' }}>
            <span>Create Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  const spec = dataset.specification;
  const report = dataset.validationReport;
  const anomalies = dataset.anomalyLogs || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Engineering Documentation &amp; Audit Report</h1>
            <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
              DOC-ID: {dataset.id}
            </span>
          </div>
          <p className="page-subtitle">
            Formal technical specification, schema invariants, statistical validation measurements, and anomaly trace log.
          </p>
        </div>

        {/* Export Actions Strip */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportDatasetToCsv(dataset)}
          >
            <Download size={13} />
            <span>Download CSV</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportSpecificationJson(spec)}
          >
            <Download size={13} />
            <span>Download Spec</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportValidationReportMarkdown(report, dataset)}
          >
            <Download size={13} />
            <span>Validation Report</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => exportAnomalyLogCsv(anomalies, dataset.name)}
          >
            <Download size={13} />
            <span>Anomaly Log</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Executive Summary */}
        <div className="section-card">
          <div className="section-card-title" style={{ fontSize: '15px', marginBottom: '14px' }}>
            1. Executive &amp; Generation Metadata
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Dataset Identifier</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{dataset.name}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Deterministic Seed</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{dataset.seed}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Row Volume</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{dataset.rowCount.toLocaleString()} records</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Generation Latency</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{dataset.generationDurationMs} ms</div>
            </div>
          </div>
        </div>

        {/* Section 2: Requirements Specification */}
        <div className="section-card">
          <div className="section-card-title" style={{ fontSize: '15px', marginBottom: '10px' }}>
            2. Compiler Requirement Prompt &amp; Parameter Constraints
          </div>

          <div 
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
              marginBottom: '14px'
            }}
          >
            "{spec.prompt}"
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Target Fraud Rate: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{spec.edgeCases.fraudRate}%</strong>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Weekend Sales Uplift: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>+{spec.edgeCases.weekendSalesIncrease}%</strong>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Extreme Outliers: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{spec.edgeCases.extremeValuesRate}%</strong>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Missing Values (Nulls): </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{spec.edgeCases.missingValuesRate}%</strong>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Duplicate Key Rate: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{spec.edgeCases.duplicateRate}%</strong>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Invalid Date Rate: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{spec.edgeCases.invalidDatesRate}%</strong>
            </div>
          </div>
        </div>

        {/* Section 3: Schema Column Specifications */}
        <div className="section-card">
          <div className="section-card-title" style={{ fontSize: '15px', marginBottom: '14px' }}>
            3. Schema Column Specifications ({spec.schema.length} fields)
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Type</th>
                  <th>Nullability</th>
                  <th>Description / Invariants</th>
                </tr>
              </thead>
              <tbody>
                {spec.schema.map(col => (
                  <tr key={col.name}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{col.name}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{col.type}</span>
                    </td>
                    <td>{col.nullable ? 'YES (Nullable)' : 'NO (Required)'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{col.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Validation Results */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div className="section-card-title" style={{ fontSize: '15px', margin: 0 }}>
              4. Empirical Validation Audit Results
            </div>
            <span className={`badge ${report.overallStatus === 'PASSED' ? 'badge-success' : 'badge-warning'}`} style={{ fontWeight: 600 }}>
              {report.overallStatus} ({report.complianceRate}% Compliance)
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric / Invariant</th>
                  <th style={{ textAlign: 'center' }}>Target</th>
                  <th style={{ textAlign: 'center' }}>Actual</th>
                  <th style={{ textAlign: 'center' }}>Deviation</th>
                  <th style={{ textAlign: 'center' }}>Tolerance</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map(chk => (
                  <tr key={chk.id}>
                    <td style={{ fontWeight: 500 }}>{chk.metric}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{chk.target}{chk.unit}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{chk.actual}{chk.unit}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {chk.deviation > 0 ? `+${chk.deviation}` : chk.deviation}{chk.unit}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>±{chk.tolerance}{chk.unit}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${chk.status === 'PASS' ? 'badge-success' : 'badge-warning'}`}>
                        {chk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Anomaly Summary */}
        <div className="section-card">
          <div className="section-card-title" style={{ fontSize: '15px', marginBottom: '14px' }}>
            5. Anomaly Audit Log Summary ({anomalies.length} Recorded Tracepoints)
          </div>

          <p className="section-card-desc" style={{ marginBottom: '14px' }}>
            All edge cases are deterministically indexed. The complete trace log contains row IDs, original values, modified values, and injection rules.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => exportAnomalyLogCsv(anomalies, dataset.name)}
            >
              <Download size={13} />
              <span>Download Full Anomaly CSV ({anomalies.length} records)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
