import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Play, 
  Table as TableIcon, 
  SlidersHorizontal, 
  Layers, 
  Plus, 
  Trash2,
  Sparkles
} from 'lucide-react';
import type { DatasetSpecification, DomainType, ColumnDefinition } from '../types';

interface SpecificationReviewViewProps {
  initialSpec: DatasetSpecification;
  onBack: () => void;
  onGenerateDataset: (spec: DatasetSpecification) => void;
  onGenerateWithGemini?: (spec: DatasetSpecification) => void;
}

export const SpecificationReviewView: React.FC<SpecificationReviewViewProps> = ({
  initialSpec,
  onBack,
  onGenerateDataset,
  onGenerateWithGemini
}) => {
  const [spec, setSpec] = useState<DatasetSpecification>({ ...initialSpec });

  const handleUpdateField = <K extends keyof DatasetSpecification>(field: K, val: DatasetSpecification[K]) => {
    setSpec(prev => ({ ...prev, [field]: val }));
  };

  const handleUpdateEdgeCase = (key: keyof DatasetSpecification['edgeCases'], val: number) => {
    setSpec(prev => ({
      ...prev,
      edgeCases: {
        ...prev.edgeCases,
        [key]: val
      }
    }));
  };

  const handleUpdateColumn = (idx: number, updated: Partial<ColumnDefinition>) => {
    const newSchema = [...spec.schema];
    newSchema[idx] = { ...newSchema[idx], ...updated };
    setSpec(prev => ({ ...prev, schema: newSchema }));
  };

  const handleAddColumn = () => {
    const newCol: ColumnDefinition = {
      name: `field_${spec.schema.length + 1}`,
      type: 'varchar',
      nullable: true,
      description: 'Custom user defined field'
    };
    setSpec(prev => ({ ...prev, schema: [...prev.schema, newCol] }));
  };

  const handleDeleteColumn = (idx: number) => {
    setSpec(prev => ({
      ...prev,
      schema: prev.schema.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Review Dataset Specification</h1>
          <p className="page-subtitle">
            Fine-tune schema columns, adjust statistical edge-case rates, and lock seed parameters before synthesizing records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => onGenerateDataset(spec)}
          >
            <Play size={14} fill="currentColor" />
            <span>Generate Dataset</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Dataset Metadata */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="section-card-title" style={{ margin: 0 }}>Dataset Core Metadata</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label className="form-label">Dataset Name</label>
              <input
                type="text"
                className="input-text"
                value={spec.name}
                onChange={(e) => handleUpdateField('name', e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label className="form-label">Target Rows</label>
              <input
                type="number"
                step="500"
                className="input-text"
                value={spec.totalRows}
                onChange={(e) => handleUpdateField('totalRows', Math.max(100, parseInt(e.target.value, 10) || 100))}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label className="form-label">Domain Archetype</label>
              <select
                className="input-select"
                value={spec.domain}
                onChange={(e) => handleUpdateField('domain', e.target.value as DomainType)}
              >
                <option value="ecommerce">E-Commerce Transactions</option>
                <option value="fintech">Fintech Wire Transfers</option>
                <option value="iot">IoT Sensor Telemetry</option>
                <option value="saas_churn">SaaS Customer Churn</option>
                <option value="healthcare">Healthcare Clinical</option>
              </select>
            </div>

            <div>
              <label className="form-label">Deterministic PRNG Seed</label>
              <input
                type="number"
                className="input-text"
                value={spec.seed}
                onChange={(e) => handleUpdateField('seed', parseInt(e.target.value, 10) || 1)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Schema Builder */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TableIcon size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="section-card-title" style={{ margin: 0 }}>
                Schema Definition ({spec.schema.length} Columns)
              </span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleAddColumn}>
              <Plus size={13} />
              <span>Add Column</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Column Name</th>
                  <th style={{ width: '18%' }}>Data Type</th>
                  <th style={{ width: '15%' }}>Nullable</th>
                  <th style={{ width: '35%' }}>Description / Constraints</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {spec.schema.map((col, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        className="input-text"
                        style={{ padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                        value={col.name}
                        onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="input-select"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        value={col.type}
                        onChange={(e) => handleUpdateColumn(idx, { type: e.target.value as any })}
                      >
                        <option value="uuid">uuid</option>
                        <option value="varchar">varchar</option>
                        <option value="decimal">decimal</option>
                        <option value="integer">integer</option>
                        <option value="timestamp">timestamp</option>
                        <option value="boolean">boolean</option>
                        <option value="categorical">categorical</option>
                      </select>
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={col.nullable}
                          onChange={(e) => handleUpdateColumn(idx, { nullable: e.target.checked })}
                        />
                        <span>{col.nullable ? 'Nullable' : 'Required'}</span>
                      </label>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input-text"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        value={col.description || ''}
                        placeholder="Constraints or description..."
                        onChange={(e) => handleUpdateColumn(idx, { description: e.target.value })}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 6px', color: 'var(--text-muted)' }}
                        onClick={() => handleDeleteColumn(idx)}
                        disabled={spec.schema.length <= 2}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Edge Cases & Anomaly Controls */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <SlidersHorizontal size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="section-card-title" style={{ margin: 0 }}>
              Controlled Edge Cases &amp; Anomaly Injections
            </span>
          </div>
          <p className="section-card-desc">
            Exact percentages of intentional edge cases that will be synthesized into the output dataset with full row-level audit traceability.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fraud / AML Flag Rate</span>
                <span className="badge badge-danger" style={{ fontSize: '10px' }}>High Severity</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  className="input-text"
                  value={spec.edgeCases.fraudRate}
                  onChange={(e) => handleUpdateEdgeCase('fraudRate', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {Math.round((spec.edgeCases.fraudRate / 100) * spec.totalRows).toLocaleString()} rows
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Weekend Volume Increase</span>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>Seasonality</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="200"
                  className="input-text"
                  value={spec.edgeCases.weekendSalesIncrease}
                  onChange={(e) => handleUpdateEdgeCase('weekendSalesIncrease', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Uplift per day on Saturday and Sunday
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Extreme Outlier Values (&gt;4.5σ)</span>
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>Distribution</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  className="input-text"
                  value={spec.edgeCases.extremeValuesRate}
                  onChange={(e) => handleUpdateEdgeCase('extremeValuesRate', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {Math.round((spec.edgeCases.extremeValuesRate / 100) * spec.totalRows).toLocaleString()} rows
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Missing Values (Nulls)</span>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Imputation</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  className="input-text"
                  value={spec.edgeCases.missingValuesRate}
                  onChange={(e) => handleUpdateEdgeCase('missingValuesRate', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {Math.round((spec.edgeCases.missingValuesRate / 100) * spec.totalRows).toLocaleString()} rows
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Duplicate Key Collisions</span>
                <span className="badge badge-danger" style={{ fontSize: '10px' }}>Integrity</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  className="input-text"
                  value={spec.edgeCases.duplicateRate}
                  onChange={(e) => handleUpdateEdgeCase('duplicateRate', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {Math.round((spec.edgeCases.duplicateRate / 100) * spec.totalRows).toLocaleString()} rows
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Malformed Date Encodings</span>
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>Tripwire</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="5"
                  className="input-text"
                  value={spec.edgeCases.invalidDatesRate}
                  onChange={(e) => handleUpdateEdgeCase('invalidDatesRate', parseFloat(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ≈ {Math.round((spec.edgeCases.invalidDatesRate / 100) * spec.totalRows).toLocaleString()} rows
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>Back to Requirements</span>
          </button>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onGenerateWithGemini && (
              <button 
                className="btn btn-secondary"
                onClick={() => onGenerateWithGemini(spec)}
                title="Use your Gemini API key to directly prompt the Gemini model to synthesize realistic records"
                style={{ 
                  borderColor: 'rgba(139, 92, 246, 0.4)', 
                  backgroundColor: 'rgba(139, 92, 246, 0.08)',
                  color: '#a78bfa' 
                }}
              >
                <Sparkles size={14} style={{ color: '#a78bfa' }} />
                <span>Synthesize with Gemini AI</span>
              </button>
            )}

            <button 
              className="btn btn-primary"
              onClick={() => onGenerateDataset(spec)}
            >
              <Play size={14} fill="currentColor" />
              <span>Synthesize with Deterministic PRNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
