import React, { useState, useEffect, useRef } from 'react';
import { 
  GitCompare, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Download, 
  RefreshCw, 
  Database, 
  BarChart3, 
  Table as TableIcon, 
  Layers, 
  Sliders, 
  Activity, 
  ShieldAlert, 
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';
import type { 
  Dataset, 
  ValidationComparisonResult 
} from '../types';
import { 
  runValidationComparisonService, 
  checkBackendHealth, 
  fetchSampleBenchmarkPair,
  generateValidationReportMarkdown,
  generateValidationComparisonCsv
} from '../services/validationLabService';

interface ValidationLabViewProps {
  activeDataset: Dataset | null;
  allDatasets: Dataset[];
  onSelectDatasetTab?: () => void;
}

export const ValidationLabView: React.FC<ValidationLabViewProps> = ({
  activeDataset,
  allDatasets,
  onSelectDatasetTab
}) => {
  // Upload States
  const [synthFilename, setSynthFilename] = useState<string>('');
  const [synthCsv, setSynthCsv] = useState<string>('');
  const [refFilename, setRefFilename] = useState<string>('');
  const [refCsv, setRefCsv] = useState<string>('');

  // Processing States
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ValidationComparisonResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // System & Health State
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [activeNumericCol, setActiveNumericCol] = useState<string>('');
  const [activeCategoricalCol, setActiveCategoricalCol] = useState<string>('');
  const [selectedIssueCategory, setSelectedIssueCategory] = useState<string>('ALL');
  const [showHeadPreviews, setShowHeadPreviews] = useState<boolean>(false);

  // File Inputs
  const synthFileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(status => {
      setIsBackendHealthy(status);
    });
  }, []);

  // When comparison completes, set active columns
  useEffect(() => {
    if (comparisonResult) {
      if (comparisonResult.numeric_comparison.length > 0) {
        setActiveNumericCol(comparisonResult.numeric_comparison[0].column);
      }
      if (comparisonResult.categorical_comparison.length > 0) {
        setActiveCategoricalCol(comparisonResult.categorical_comparison[0].column);
      }
    }
  }, [comparisonResult]);

  // Serialize dataset to CSV string
  const serializeDataset = (ds: Dataset): string => {
    if (!ds || !ds.records || ds.records.length === 0) return '';
    const columns = ds.specification?.schema?.map(c => c.name) || Object.keys(ds.records[0]);
    const headers = columns.join(',');
    const rows = ds.records.map(record => {
      return columns.map(col => {
        const val = record[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(',');
    });
    return [headers, ...rows].join('\n');
  };

  // Load active dataset from memory
  const handleLoadActiveDatasetAsSynthetic = (targetDataset?: Dataset) => {
    const ds = targetDataset || activeDataset;
    if (!ds) return;
    const csv = serializeDataset(ds);
    const fname = `${ds.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_synthetic.csv`;
    setSynthFilename(fname);
    setSynthCsv(csv);
    setErrorMessage(null);
  };

  // Load Benchmark Demo Pair
  const handleLoadDemoPair = async () => {
    setIsComparing(true);
    setErrorMessage(null);
    try {
      const demo = await fetchSampleBenchmarkPair();
      setSynthFilename(demo.syntheticName);
      setSynthCsv(demo.syntheticCsv);
      setRefFilename(demo.referenceName);
      setRefCsv(demo.referenceCsv);

      // Automatically execute comparison for smooth demo
      const result = await runValidationComparisonService(
        demo.syntheticName,
        demo.syntheticCsv,
        demo.referenceName,
        demo.referenceCsv
      );
      setComparisonResult(result);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load sample benchmark pair');
    } finally {
      setIsComparing(false);
    }
  };

  // File reader helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'synthetic' | 'reference'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (type === 'synthetic') {
        setSynthFilename(file.name);
        setSynthCsv(text);
      } else {
        setRefFilename(file.name);
        setRefCsv(text);
      }
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage(`Failed to read file ${file.name}`);
    };
    reader.readAsText(file);
  };

  // Execute comparison
  const handleExecuteComparison = async () => {
    if (!synthCsv || !refCsv) {
      setErrorMessage('Please provide both Synthetic Dataset and Reference Dataset before running comparison.');
      return;
    }

    setIsComparing(true);
    setErrorMessage(null);

    try {
      const result = await runValidationComparisonService(
        synthFilename || 'synthetic_dataset.csv',
        synthCsv,
        refFilename || 'reference_dataset.csv',
        refCsv
      );
      setComparisonResult(result);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error occurred during statistical comparison calculation.');
    } finally {
      setIsComparing(false);
    }
  };

  // Download Markdown Report
  const handleDownloadReport = () => {
    if (!comparisonResult) return;
    const md = generateValidationReportMarkdown(comparisonResult);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_report_${comparisonResult.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!comparisonResult) return;
    const csv = generateValidationComparisonCsv(comparisonResult);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_deltas_${comparisonResult.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedNumeric = comparisonResult?.numeric_comparison.find(n => n.column === activeNumericCol);
  const selectedCategorical = comparisonResult?.categorical_comparison.find(c => c.column === activeCategoricalCol);

  const filteredIssues = comparisonResult?.potential_issues.filter(issue => {
    if (selectedIssueCategory === 'ALL') return true;
    return issue.category === selectedIssueCategory;
  }) || [];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-neutral" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
              Benchmarking & Validation
            </span>
            <div 
              className="badge" 
              style={{ 
                backgroundColor: 'var(--surface-elevated)', 
                borderColor: 'var(--border)', 
                color: isBackendHealthy ? 'var(--success)' : 'var(--warning)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title={isBackendHealthy ? 'Python NumPy/Pandas API Online at port 8000' : 'In-Browser Math Engine Active'}
            >
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: isBackendHealthy ? 'var(--success)' : 'var(--warning)' 
                }} 
              />
              <span>{isBackendHealthy ? 'Python NumPy Engine (v2.4)' : 'Dual Math Engine (Client & Server)'}</span>
            </div>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCompare style={{ color: 'var(--accent-primary)' }} size={24} />
            <span>Synthetic vs Reference Validation Lab</span>
          </h1>
          <p className="page-subtitle">
            Statistically evaluate synthetic datasets against reference benchmarks (e.g. Kaggle datasets) using two-sample KS hypothesis tests, Wasserstein distance, Total Variation Distance, and correlation preservation.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleLoadDemoPair}
            disabled={isComparing}
            title="Load retail e-commerce benchmark pair (2,500 records)"
          >
            <Cpu size={14} />
            <span>Load Benchmark Demo Pair</span>
          </button>

          <button 
            className="btn btn-primary"
            onClick={handleExecuteComparison}
            disabled={isComparing || !synthCsv || !refCsv}
          >
            {isComparing ? (
              <>
                <RefreshCw size={14} className="spin-animation" />
                <span>Computing Statistics...</span>
              </>
            ) : (
              <>
                <BarChart3 size={14} />
                <span>Run Comparison</span>
              </>
            )}
          </button>

          {comparisonResult && (
            <>
              <button 
                className="btn btn-secondary"
                onClick={handleDownloadReport}
                title="Download comprehensive Markdown report"
              >
                <Download size={14} />
                <span>Report (.md)</span>
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleExportCsv}
                title="Export metric deltas as CSV"
              >
                <FileSpreadsheet size={14} />
                <span>Deltas (.csv)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div 
          style={{ 
            marginBottom: '20px', 
            padding: '12px 16px', 
            backgroundColor: 'var(--danger-subtle)', 
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--danger)'
          }}
        >
          <AlertCircle size={16} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{errorMessage}</span>
        </div>
      )}

      {/* Methodological Disclaimer */}
      <div 
        style={{ 
          marginBottom: '20px', 
          padding: '12px 16px', 
          backgroundColor: 'var(--surface)', 
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}
      >
        <Info size={16} style={{ color: 'var(--info)', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Validation Protocol & Reference Baseline: </strong>
          The reference dataset is an empirical baseline (e.g., from Kaggle or production logs), not assumed to be infallible ground truth. Statistical metrics (Kolmogorov-Smirnov test, Wasserstein metric, TVD) compare empirical distributions deterministically without synthetic score fabrication.
        </div>
      </div>

      {/* Dual Dataset Uploader Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        
        {/* Synthetic Dataset Card */}
        <div 
          style={{ 
            backgroundColor: 'var(--surface)', 
            border: synthCsv ? '1px solid var(--accent-border)' : '1px dashed var(--border)', 
            borderRadius: 'var(--radius-md)',
            padding: '18px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>1. Synthetic Dataset</span>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Input A</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeDataset && (
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleLoadActiveDatasetAsSynthetic(activeDataset)}
                  title={`Load active dataset '${activeDataset.name}'`}
                  style={{ fontSize: '11px', color: 'var(--accent-primary)' }}
                >
                  Use Active Dataset ({activeDataset.records.length} rows)
                </button>
              )}
              {allDatasets && allDatasets.length > 1 && (
                <select 
                  className="input-select"
                  style={{ fontSize: '11px', padding: '2px 6px', width: 'auto' }}
                  onChange={(e) => {
                    const ds = allDatasets.find(d => d.id === e.target.value);
                    if (ds) handleLoadActiveDatasetAsSynthetic(ds);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Other memory datasets...</option>
                  {allDatasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.records?.length || 0} rows)</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Upload the synthetic dataset generated by SyntheticLab or external generators (.csv, .xlsx).
          </p>

          <input 
            type="file" 
            ref={synthFileInputRef} 
            onChange={(e) => handleFileUpload(e, 'synthetic')} 
            accept=".csv,.tsv,.txt" 
            style={{ display: 'none' }} 
          />

          <div 
            onClick={() => synthFileInputRef.current?.click()}
            style={{ 
              padding: '20px 16px', 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px dashed var(--border)', 
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease'
            }}
          >
            <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {synthFilename ? synthFilename : 'Click to select Synthetic CSV file'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {synthCsv ? `${(synthCsv.length / 1024).toFixed(1)} KB loaded in memory` : 'Accepts UTF-8 CSV or TSV'}
            </div>
          </div>
        </div>

        {/* Reference Dataset Card */}
        <div 
          style={{ 
            backgroundColor: 'var(--surface)', 
            border: refCsv ? '1px solid var(--success-border)' : '1px dashed var(--border)', 
            borderRadius: 'var(--radius-md)',
            padding: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TableIcon size={16} style={{ color: 'var(--success)' }} />
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>2. Reference Dataset</span>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Input B</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Comparison Baseline</span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Upload real-world empirical data, e.g. public Kaggle retail log or production sample (.csv).
          </p>

          <input 
            type="file" 
            ref={refFileInputRef} 
            onChange={(e) => handleFileUpload(e, 'reference')} 
            accept=".csv,.tsv,.txt" 
            style={{ display: 'none' }} 
          />

          <div 
            onClick={() => refFileInputRef.current?.click()}
            style={{ 
              padding: '20px 16px', 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px dashed var(--border)', 
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease'
            }}
          >
            <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {refFilename ? refFilename : 'Click to select Reference CSV file'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {refCsv ? `${(refCsv.length / 1024).toFixed(1)} KB loaded in memory` : 'Accepts UTF-8 CSV or TSV'}
            </div>
          </div>
        </div>

      </div>

      {/* When no comparison has run yet */}
      {!comparisonResult && (
        <div 
          style={{ 
            backgroundColor: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: 'var(--radius-md)', 
            padding: '40px 24px', 
            textAlign: 'center' 
          }}
        >
          <GitCompare size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            No Validation Comparison Executed
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 18px auto' }}>
            Select your Synthetic and Reference files above, or click <strong>Load Benchmark Demo Pair</strong> to instantly test the two-sample hypothesis tests and metric divergence tools.
          </p>
          <button 
            className="btn btn-primary"
            onClick={handleLoadDemoPair}
            disabled={isComparing}
          >
            <Cpu size={14} />
            <span>Load Benchmark Demo Pair & Run</span>
          </button>
          {onSelectDatasetTab && (
            <button 
              className="btn btn-secondary"
              onClick={onSelectDatasetTab}
              style={{ marginLeft: '10px' }}
            >
              <span>Explore Saved Datasets</span>
            </button>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section 1: Executive Summary & Similarity Index */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
            
            {/* Similarity Score Card */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Statistical Similarity
                  </span>
                  <span className={`badge ${comparisonResult.similarity_index.index_value >= 80 ? 'badge-success' : comparisonResult.similarity_index.index_value >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                    {comparisonResult.similarity_index.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '14px 0' }}>
                  <span style={{ fontSize: '42px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
                    {comparisonResult.similarity_index.index_value.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    / 100
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                  {Object.entries(comparisonResult.similarity_index.contributing_components).map(([key, val]) => {
                    const labelMap: Record<string, string> = {
                      schema_alignment: 'Schema Alignment (20%)',
                      numeric_distributions: 'Numeric Distributions (25%)',
                      categorical_fidelity: 'Categorical Proportions (20%)',
                      correlation_preservation: 'Correlation Preservation (20%)',
                      missingness_alignment: 'Missingness Alignment (15%)'
                    };
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{labelMap[key] || key}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{val}%</span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${val}%`, 
                              height: '100%', 
                              backgroundColor: val >= 80 ? 'var(--success)' : val >= 60 ? 'var(--warning)' : 'var(--danger)',
                              borderRadius: '2px'
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontStyle: 'italic' }}>
                {comparisonResult.similarity_index.interpretation_disclaimer}
              </div>
            </div>

            {/* Executive Summary Card */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '20px' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Executive Validation Summary
                  </span>
                </div>
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  Compatibility: {comparisonResult.executive_summary.dataset_compatibility}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Numeric Distributions</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{comparisonResult.executive_summary.numeric_summary}</div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Categorical Fidelity</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{comparisonResult.executive_summary.categorical_summary}</div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Missingness Alignment</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{comparisonResult.executive_summary.missingness_summary}</div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Correlation Structure</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{comparisonResult.executive_summary.correlation_summary}</div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Key Findings:</span>
                <ul style={{ marginTop: '8px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {comparisonResult.executive_summary.key_findings.map((f, idx) => (
                    <li key={idx} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Section 2: Dataset Previews & Schema Overlap */}
          <div 
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden' 
            }}
          >
            <div 
              style={{ 
                padding: '14px 18px', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                backgroundColor: 'var(--surface-elevated)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={16} style={{ color: 'var(--info)' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Dataset Previews & Schema Analysis
                </span>
                <span className={`badge ${comparisonResult.schema_analysis.schema_compatibility === 'HIGH' ? 'badge-success' : comparisonResult.schema_analysis.schema_compatibility === 'MEDIUM' ? 'badge-warning' : 'badge-danger'}`}>
                  {comparisonResult.schema_analysis.schema_compatibility} COMPATIBILITY ({Math.round(comparisonResult.schema_analysis.overlap_ratio * 100)}% OVERLAP)
                </span>
              </div>

              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setShowHeadPreviews(!showHeadPreviews)}
                style={{ fontSize: '12px' }}
              >
                <span>{showHeadPreviews ? 'Hide Raw Head Previews' : 'Show First 5 Rows Sample'}</span>
                {showHeadPreviews ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Metrics Grid */}
            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Row Count</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {comparisonResult.previews.synthetic.row_count.toLocaleString()}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}> vs </span>
                  {comparisonResult.previews.reference.row_count.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Synthetic vs Reference</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Common Columns</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--success)', marginTop: '4px' }}>
                  {comparisonResult.schema_analysis.common_columns_count}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  of {comparisonResult.previews.synthetic.column_count} synth & {comparisonResult.previews.reference.column_count} ref
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type Mismatches</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: comparisonResult.schema_analysis.type_mismatches_count === 0 ? 'var(--success)' : 'var(--danger)', marginTop: '4px' }}>
                  {comparisonResult.schema_analysis.type_mismatches_count}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {comparisonResult.schema_analysis.type_mismatches_count === 0 ? 'Exact type alignment' : 'Incompatible types'}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Synthetic Missing Cells</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {comparisonResult.previews.synthetic.missing_rate_pct}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {comparisonResult.previews.synthetic.total_missing_cells} cells
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reference Missing Cells</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {comparisonResult.previews.reference.missing_rate_pct}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {comparisonResult.previews.reference.total_missing_cells} cells
                </div>
              </div>
            </div>

            {/* Column Chips List */}
            <div style={{ padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '130px' }}>Common Columns:</span>
                {comparisonResult.schema_analysis.common_columns.map(c => (
                  <span key={c} className="badge badge-success" style={{ fontSize: '11px' }}>
                    {c}
                  </span>
                ))}
              </div>

              {comparisonResult.schema_analysis.synthetic_only_columns.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '130px' }}>Synthetic-Only:</span>
                  {comparisonResult.schema_analysis.synthetic_only_columns.map(c => (
                    <span key={c} className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {comparisonResult.schema_analysis.reference_only_columns.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '130px' }}>Reference-Only:</span>
                  {comparisonResult.schema_analysis.reference_only_columns.map(c => (
                    <span key={c} className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {comparisonResult.schema_analysis.type_mismatches.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--danger)', width: '130px' }}>Type Mismatches:</span>
                  {comparisonResult.schema_analysis.type_mismatches.map(m => (
                    <span key={m.column} className="badge badge-danger" style={{ fontSize: '11px' }}>
                      {m.column}: {m.synthetic_type} ≠ {m.reference_type}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Collapsible Head Preview Tables */}
            {showHeadPreviews && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '18px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                    Synthetic Dataset Sample (Top 5 rows):
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="data-table" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {comparisonResult.previews.synthetic.columns.map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.previews.synthetic.head_sample.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            {comparisonResult.previews.synthetic.columns.map(col => (
                              <td key={col} style={{ fontFamily: 'var(--font-mono)' }}>
                                {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--text-muted)' }}>null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                    Reference Dataset Sample (Top 5 rows):
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="data-table" style={{ fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {comparisonResult.previews.reference.columns.map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.previews.reference.head_sample.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            {comparisonResult.previews.reference.columns.map(col => (
                              <td key={col} style={{ fontFamily: 'var(--font-mono)' }}>
                                {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--text-muted)' }}>null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Section 3: Numeric Distribution Comparison (Interactive Column Selector & Histogram) */}
          {comparisonResult.numeric_comparison.length > 0 && (
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden' 
              }}
            >
              <div 
                style={{ 
                  padding: '14px 18px', 
                  borderBottom: '1px solid var(--border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--surface-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Numeric Distribution Comparison & Goodness-of-Fit Tests
                  </span>
                </div>

                {/* Column Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Column:</span>
                  <select 
                    className="input-select"
                    value={activeNumericCol}
                    onChange={(e) => setActiveNumericCol(e.target.value)}
                    style={{ width: '180px', padding: '4px 8px', fontSize: '12px' }}
                  >
                    {comparisonResult.numeric_comparison.map(n => (
                      <option key={n.column} value={n.column}>
                        {n.column}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedNumeric && (
                <div style={{ padding: '20px' }}>
                  
                  {/* Goodness-of-fit Hypotheses Banner */}
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(4, 1fr)', 
                      gap: '12px', 
                      marginBottom: '20px',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Two-Sample KS Statistic (D)</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedNumeric.statistical_tests.ks_statistic.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Max CDF distance</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Asymptotic p-value</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selectedNumeric.statistical_tests.ks_passed_similarity ? 'var(--success)' : 'var(--warning)', marginTop: '2px' }}>
                        {selectedNumeric.statistical_tests.ks_pvalue < 0.0001 
                          ? selectedNumeric.statistical_tests.ks_pvalue.toExponential(2) 
                          : selectedNumeric.statistical_tests.ks_pvalue.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {selectedNumeric.statistical_tests.ks_passed_similarity ? 'p ≥ 0.05 (H0 Not Rejected)' : 'p < 0.05 (Empirical Drift)'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wasserstein-1 Distance</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedNumeric.statistical_tests.wasserstein_distance.toFixed(3)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Earth Mover's Distance</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mean & Variance Drift</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                        Δμ: {selectedNumeric.deltas.mean_diff > 0 ? '+' : ''}{selectedNumeric.deltas.mean_diff}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Δσ: {selectedNumeric.deltas.std_diff > 0 ? '+' : ''}{selectedNumeric.deltas.std_diff} ({Math.abs(selectedNumeric.deltas.std_rel_diff_pct)}%)
                      </div>
                    </div>
                  </div>

                  {/* Comparative 12-Bin Histogram Visualizer */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Relative Frequency Distribution Comparison (12 Bins):
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-primary)', borderRadius: '2px' }} />
                          <span style={{ color: 'var(--text-primary)' }}>Synthetic ({selectedNumeric.synthetic.count} rows)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '2px' }} />
                          <span style={{ color: 'var(--text-primary)' }}>Reference ({selectedNumeric.reference.count} rows)</span>
                        </div>
                      </div>
                    </div>

                    {/* SVG Binned Histogram */}
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 12px 10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedNumeric.histogram.bins.length}, 1fr)`, gap: '8px', height: '160px', alignItems: 'flex-end' }}>
                        {selectedNumeric.histogram.bins.map((bin, i) => {
                          const sPct = selectedNumeric.histogram.synthetic_pct[i] || 0;
                          const rPct = selectedNumeric.histogram.reference_pct[i] || 0;
                          const maxPct = Math.max(...selectedNumeric.histogram.synthetic_pct, ...selectedNumeric.histogram.reference_pct, 1);
                          const sH = Math.max(3, (sPct / maxPct) * 135);
                          const rH = Math.max(3, (rPct / maxPct) * 135);

                          return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }} title={`Bin ${bin}\nSynthetic: ${sPct}%\nReference: ${rPct}%`}>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                                <div 
                                  style={{ 
                                    width: '45%', 
                                    height: `${sH}px`, 
                                    backgroundColor: 'var(--accent-primary)', 
                                    borderRadius: '2px 2px 0 0',
                                    opacity: 0.9,
                                    transition: 'height 0.2s ease'
                                  }} 
                                />
                                <div 
                                  style={{ 
                                    width: '45%', 
                                    height: `${rH}px`, 
                                    backgroundColor: 'var(--success)', 
                                    borderRadius: '2px 2px 0 0',
                                    opacity: 0.85,
                                    transition: 'height 0.2s ease'
                                  }} 
                                />
                              </div>
                              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                {bin}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary Statistics Table */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* Stats Table */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Statistical Moment & Spread Metrics
                      </div>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th>Synthetic</th>
                            <th>Reference</th>
                            <th>Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 500 }}>Mean (μ)</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.synthetic.mean}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.reference.mean}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: Math.abs(selectedNumeric.deltas.mean_rel_diff_pct) > 10 ? 'var(--warning)' : 'var(--text-primary)' }}>
                              {selectedNumeric.deltas.mean_diff > 0 ? '+' : ''}{selectedNumeric.deltas.mean_diff} ({selectedNumeric.deltas.mean_rel_diff_pct}%)
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 500 }}>Median (Q2)</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.synthetic.median}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.reference.median}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {selectedNumeric.deltas.median_diff > 0 ? '+' : ''}{selectedNumeric.deltas.median_diff}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 500 }}>Std Dev (σ)</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.synthetic.std}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.reference.std}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {selectedNumeric.deltas.std_diff > 0 ? '+' : ''}{selectedNumeric.deltas.std_diff}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 500 }}>Interquartile Range (IQR)</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.synthetic.iqr}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{selectedNumeric.reference.iqr}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {selectedNumeric.deltas.iqr_diff > 0 ? '+' : ''}{selectedNumeric.deltas.iqr_diff}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 500 }}>Observed Range [Min, Max]</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>[{selectedNumeric.synthetic.min}, {selectedNumeric.synthetic.max}]</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>[{selectedNumeric.reference.min}, {selectedNumeric.reference.max}]</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              Δmin: {(selectedNumeric.synthetic.min - selectedNumeric.reference.min).toFixed(1)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Quantiles Grid */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Quantile Percentiles Alignment
                      </div>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Percentile</th>
                            <th>Synthetic</th>
                            <th>Reference</th>
                            <th>Discrepancy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['p5', 'p25', 'p50', 'p75', 'p95', 'p99'].map(q => {
                            const sVal = selectedNumeric.quantiles.synthetic[q] ?? 0;
                            const rVal = selectedNumeric.quantiles.reference[q] ?? 0;
                            const diff = +(sVal - rVal).toFixed(2);
                            return (
                              <tr key={q}>
                                <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{q.toUpperCase()}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{sVal}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{rVal}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', color: Math.abs(diff) > 20 ? 'var(--warning)' : 'var(--text-primary)' }}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

          {/* Section 4: Categorical Distribution Comparison & Total Variation Distance */}
          {comparisonResult.categorical_comparison.length > 0 && (
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden' 
              }}
            >
              <div 
                style={{ 
                  padding: '14px 18px', 
                  borderBottom: '1px solid var(--border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--surface-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sliders size={16} style={{ color: 'var(--success)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Categorical Proportion Fidelity & Total Variation Distance (TVD)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Column:</span>
                  <select 
                    className="input-select"
                    value={activeCategoricalCol}
                    onChange={(e) => setActiveCategoricalCol(e.target.value)}
                    style={{ width: '180px', padding: '4px 8px', fontSize: '12px' }}
                  >
                    {comparisonResult.categorical_comparison.map(c => (
                      <option key={c.column} value={c.column}>
                        {c.column}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCategorical && (
                <div style={{ padding: '20px' }}>
                  
                  {/* Categorical Overview Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Variation Distance</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selectedCategorical.total_variation_distance <= 0.15 ? 'var(--success)' : 'var(--warning)', marginTop: '2px' }}>
                        {selectedCategorical.total_variation_distance.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {selectedCategorical.total_variation_distance <= 0.1 ? 'High fidelity (TVD ≤ 0.10)' : 'Moderate divergence'}
                      </div>
                    </div>

                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unique Categories</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedCategorical.synthetic_unique_count} vs {selectedCategorical.reference_unique_count}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Synthetic vs Reference</div>
                    </div>

                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Missing in Synthetic</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selectedCategorical.missing_from_synthetic.length === 0 ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
                        {selectedCategorical.missing_from_synthetic.length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {selectedCategorical.missing_from_synthetic.length === 0 ? 'All categories covered' : selectedCategorical.missing_from_synthetic.slice(0, 2).join(', ')}
                      </div>
                    </div>

                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Frequency Shifts (&gt;5%)</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selectedCategorical.large_frequency_shifts.length === 0 ? 'var(--success)' : 'var(--warning)', marginTop: '2px' }}>
                        {selectedCategorical.large_frequency_shifts.length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Significant proportion shifts</div>
                    </div>
                  </div>

                  {/* Categories Proportions Table */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <table className="data-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Category Value</th>
                          <th>Synthetic Proportion</th>
                          <th>Reference Proportion</th>
                          <th>Proportion Delta</th>
                          <th style={{ width: '220px' }}>Relative Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCategorical.categories.map(cat => {
                          const isShift = Math.abs(cat.delta_pct) >= 5;
                          return (
                            <tr key={cat.category}>
                              <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                {cat.category}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>
                                {cat.synthetic_pct}% ({cat.synthetic_count.toLocaleString()})
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>
                                {cat.reference_pct}% ({cat.reference_count.toLocaleString()})
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', color: isShift ? 'var(--warning)' : 'var(--text-primary)', fontWeight: isShift ? 600 : 400 }}>
                                {cat.delta_pct > 0 ? '+' : ''}{cat.delta_pct}%
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--accent-primary)', width: '20px' }}>SYN</span>
                                    <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, cat.synthetic_pct)}%`, height: '100%', backgroundColor: 'var(--accent-primary)' }} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--success)', width: '20px' }}>REF</span>
                                    <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, cat.reference_pct)}%`, height: '100%', backgroundColor: 'var(--success)' }} />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Section 5: Missingness & Outliers Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Missing Value Analysis */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden' 
              }}
            >
              <div 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border)', 
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCheck size={16} style={{ color: 'var(--info)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Missing Value Discrepancy Analysis
                </span>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Synth Missing %</th>
                      <th>Ref Missing %</th>
                      <th>Delta</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonResult.missing_comparison.map(m => (
                      <tr key={m.column}>
                        <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{m.column}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{m.synthetic_missing_pct}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{m.reference_missing_pct}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {m.difference_pct > 0 ? '+' : ''}{m.difference_pct}%
                        </td>
                        <td>
                          <span className={`badge ${m.is_substantial_discrepancy ? 'badge-warning' : 'badge-success'}`}>
                            {m.is_substantial_discrepancy ? 'Discrepancy' : 'Aligned'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outlier Analysis */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden' 
              }}
            >
              <div 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border)', 
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ShieldAlert size={16} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Extreme Outlier Rates (1.5x IQR Tukey Rule)
                </span>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Numeric Column</th>
                      <th>Synth Outlier %</th>
                      <th>Ref Outlier %</th>
                      <th>Delta</th>
                      <th>Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonResult.outlier_comparison.map(o => (
                      <tr key={o.column}>
                        <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{o.column}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{o.synthetic_outlier_pct}% ({o.synthetic_outliers_count})</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{o.reference_outlier_pct}% ({o.reference_outliers_count})</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {o.outlier_diff_pct > 0 ? '+' : ''}{o.outlier_diff_pct}%
                        </td>
                        <td>
                          <span className={`badge ${o.is_substantial_discrepancy ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '10px' }}>
                            {o.characterization}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Section 6: Correlation & Feature Relationship Preservation */}
          {comparisonResult.correlation_comparison.columns.length >= 2 && (
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden' 
              }}
            >
              <div 
                style={{ 
                  padding: '14px 18px', 
                  borderBottom: '1px solid var(--border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--surface-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Correlation Structure & Pairwise Preservation (Pearson r)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-success">
                    {comparisonResult.correlation_comparison.preserved_pairs_count} of {comparisonResult.correlation_comparison.total_pairs} Pairs Preserved
                  </span>
                  <span className="badge badge-neutral">
                    {Math.round(comparisonResult.correlation_comparison.preserved_ratio * 100)}% Fidelity
                  </span>
                </div>
              </div>

              <div style={{ padding: '18px' }}>
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Feature Pair</th>
                      <th>Synthetic Pearson r</th>
                      <th>Reference Pearson r</th>
                      <th>Correlation Delta (Δr)</th>
                      <th>Relationship Preservation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonResult.correlation_comparison.differences.map(d => {
                      const isPreserved = d.relationship_status === 'Preserved';
                      const isDivergent = d.relationship_status === 'Divergent';
                      return (
                        <tr key={d.pair}>
                          <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            {d.pair}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {d.synthetic_correlation > 0 ? '+' : ''}{d.synthetic_correlation.toFixed(3)}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {d.reference_correlation > 0 ? '+' : ''}{d.reference_correlation.toFixed(3)}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(d.difference) > 0.2 ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {d.difference > 0 ? '+' : ''}{d.difference.toFixed(3)}
                          </td>
                          <td>
                            <span 
                              className={`badge ${isPreserved ? 'badge-success' : isDivergent ? 'badge-danger' : 'badge-warning'}`}
                            >
                              {d.relationship_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 7: Potential Data Issues (Categorized) */}
          <div 
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden' 
            }}
          >
            <div 
              style={{ 
                padding: '14px 18px', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                backgroundColor: 'var(--surface-elevated)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Potential Data Quality & Drift Issues Detected ({comparisonResult.potential_issues.length})
                </span>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {['ALL', 'Schema Issues', 'Distribution Issues', 'Data Quality Issues', 'Relationship Issues'].map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${selectedIssueCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedIssueCategory(cat)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredIssues.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No issues flagged under this category.
                </div>
              ) : (
                filteredIssues.map((issue, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      padding: '12px 16px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '16px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${issue.severity === 'High' ? 'badge-danger' : issue.severity === 'Medium' ? 'badge-warning' : 'badge-neutral'}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {issue.type}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                          {issue.column}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {issue.interpretation}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '180px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Mathematical Evidence:</span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {issue.evidence}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 8: Risk Areas & Recommended Investigations */}
          <div 
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden' 
            }}
          >
            <div 
              style={{ 
                padding: '14px 18px', 
                borderBottom: '1px solid var(--border)', 
                backgroundColor: 'var(--surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Synthetic Data Risk Areas & Remediation Guidelines ({comparisonResult.risk_areas.length})
              </span>
            </div>

            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {comparisonResult.risk_areas.map((ra, idx) => (
                <div 
                  key={idx}
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {ra.category}
                      </span>
                      <span className={`badge ${ra.severity === 'High' ? 'badge-danger' : ra.severity === 'Medium' ? 'badge-warning' : 'badge-neutral'}`}>
                        {ra.severity} Risk
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Affected Attribute: <code style={{ color: 'var(--accent-primary)' }}>{ra.affected_column}</code>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                      <strong>Evidence:</strong> {ra.evidence}
                    </div>

                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Synth: {ra.synthetic_value} | Ref: {ra.reference_value}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '11px', color: 'var(--info)' }}>
                    <strong>Recommended Action:</strong> {ra.recommended_investigation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 9: ML / Testing Use-Case Suitability */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Suitable For */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--success-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '20px' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Suitable For Downstream Use Cases
                </span>
              </div>
              <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {comparisonResult.recommendations.suitable_for.map((item, idx) => (
                  <li key={idx} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Use With Caution */}
            <div 
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--warning-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '20px' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Use With Caution / Unsuitable For
                </span>
              </div>
              <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {comparisonResult.recommendations.use_with_caution.map((item, idx) => (
                  <li key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Bottom Export Bar */}
          <div 
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Export Statistical Audit Artifacts
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Download comprehensive Markdown report or CSV delta metrics for CI/CD audit logs.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={handleDownloadReport}>
                <Download size={14} />
                <span>Download Report (.md)</span>
              </button>
              <button className="btn btn-primary" onClick={handleExportCsv}>
                <FileSpreadsheet size={14} />
                <span>Export Comparison CSV (.csv)</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
