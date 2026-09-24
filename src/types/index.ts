export type DomainType = 'ecommerce' | 'fintech' | 'iot' | 'saas_churn' | 'healthcare';

export type ColumnDataType = 
  | 'uuid' 
  | 'varchar' 
  | 'decimal' 
  | 'integer' 
  | 'timestamp' 
  | 'boolean' 
  | 'categorical';

export interface ColumnDefinition {
  name: string;
  type: ColumnDataType;
  nullable: boolean;
  min?: number;
  max?: number;
  precision?: number;
  enumOptions?: string[];
  description?: string;
  isIdentifier?: boolean;
}

export interface EdgeCaseConfig {
  fraudRate: number;              // e.g. 2.0 (%)
  weekendSalesIncrease: number;   // e.g. 30.0 (%)
  extremeValuesRate: number;      // e.g. 1.0 (%)
  missingValuesRate: number;      // e.g. 2.0 (%)
  duplicateRate: number;          // e.g. 0.2 (%)
  invalidDatesRate: number;       // e.g. 0.1 (%)
  rareCategoriesRate: number;     // e.g. 0.5 (%)
}

export interface DatasetSpecification {
  id: string;
  name: string;
  domain: DomainType;
  prompt: string;
  totalRows: number;
  seed: number;
  createdAt: string;
  schema: ColumnDefinition[];
  edgeCases: EdgeCaseConfig;
}

export type AnomalyType = 
  | 'FRAUD_INJECTION'
  | 'EXTREME_VALUE'
  | 'MISSING_NULL'
  | 'DUPLICATE_KEY'
  | 'INVALID_DATE'
  | 'RARE_CATEGORY'
  | 'NEGATIVE_QUANTITY';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AnomalyLog {
  id: string;
  rowId: number;
  type: AnomalyType;
  column: string;
  originalValue: any;
  injectedValue: any;
  severity: AnomalySeverity;
  reason: string;
  ruleFormula: string;
  timestamp: string;
  datasetId: string;
}

export interface ValidationCheck {
  id: string;
  metric: string;
  target: number;
  actual: number;
  deviation: number;
  tolerance: number;
  unit: '%' | 'rows' | 'ratio';
  status: 'PASS' | 'WARNING' | 'FAIL';
  description: string;
}

export interface ValidationReport {
  datasetId: string;
  overallStatus: 'PASSED' | 'WARNING' | 'FAILED';
  complianceRate: number; // calculated mathematically (passed / total * 100)
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  checks: ValidationCheck[];
  validatedAt: string;
  statisticalMetrics: {
    meanAmount?: number;
    stdDevAmount?: number;
    minAmount?: number;
    maxAmount?: number;
    weekendTransactions?: number;
    weekdayTransactions?: number;
    nullCountByColumn: Record<string, number>;
    anomaliesByType: Record<string, number>;
  };
}

export interface DatasetRecord {
  _rowId: number;
  _hasAnomaly: boolean;
  _anomalyTypes: AnomalyType[];
  [key: string]: any;
}

export interface Dataset {
  id: string;
  name: string;
  domain: DomainType;
  rowCount: number;
  seed: number;
  createdAt: string;
  generationDurationMs: number;
  specification: DatasetSpecification;
  records: DatasetRecord[];
  validationReport: ValidationReport;
  anomalyLogs: AnomalyLog[];
  // Cloud persistence metadata (Supabase)
  cloudStatus?: 'CLOUD_SAVED' | 'LOCAL_ONLY' | 'SYNCING' | 'SYNC_FAILED';
  cloudDatasetId?: string;
  cloudJobId?: string;
  cloudStoragePath?: string;
  cloudAnomalyStoragePath?: string;
  cloudReportStoragePath?: string;
  cloudError?: string;
  cloudSyncedAt?: string;
}

export interface ActivityItem {
  id: string;
  action: 'DATASET_GENERATED' | 'VALIDATION_COMPLETED' | 'REPORT_CREATED' | 'ANOMALIES_APPLIED' | 'DATASET_EXPORTED';
  target: string;
  datasetId?: string;
  timestamp: string;
  details: string;
}

export interface StressTestResult {
  id: string;
  datasetId: string;
  name: string;
  scenario: 'HIGH_LOAD_INGESTION' | 'COVARIATE_DRIFT' | 'SCHEMA_POISONING' | 'NULL_POINTER_INJECTION';
  status: 'PASS' | 'WARN' | 'FAIL';
  throughputRps: number;
  p99LatencyMs: number;
  driftPValue: number;
  invariantsPassed: number;
  invariantsTotal: number;
  timestamp: string;
  failurePoints: string[];
}

export interface DatasetFilePreview {
  filename: string;
  filesize_bytes: number;
  row_count: number;
  column_count: number;
  numeric_column_count: number;
  categorical_column_count: number;
  datetime_column_count: number;
  id_column_count: number;
  total_missing_cells: number;
  missing_rate_pct: number;
  columns: string[];
  column_types: Record<string, string>;
  head_sample: Record<string, any>[];
}

export interface SchemaAnalysis {
  common_columns_count: number;
  synthetic_only_count: number;
  reference_only_count: number;
  type_mismatches_count: number;
  common_columns: string[];
  synthetic_only_columns: string[];
  reference_only_columns: string[];
  type_mismatches: {
    column: string;
    synthetic_type: string;
    reference_type: string;
  }[];
  schema_compatibility: 'HIGH' | 'MEDIUM' | 'LOW';
  overlap_ratio: number;
}

export interface NumericDistributionComparison {
  column: string;
  synthetic: {
    count: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    missing_pct: number;
  };
  reference: {
    count: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    missing_pct: number;
  };
  deltas: {
    mean_diff: number;
    mean_rel_diff_pct: number;
    median_diff: number;
    std_diff: number;
    std_rel_diff_pct: number;
    iqr_diff: number;
    missing_diff_pct: number;
  };
  statistical_tests: {
    ks_statistic: number;
    ks_pvalue: number;
    ks_passed_similarity: boolean;
    wasserstein_distance: number;
  };
  quantiles: {
    synthetic: Record<string, number>;
    reference: Record<string, number>;
  };
  histogram: {
    bins: string[];
    synthetic_counts: number[];
    reference_counts: number[];
    synthetic_pct: number[];
    reference_pct: number[];
  };
}

export interface CategoricalCategoryRow {
  category: string;
  synthetic_count: number;
  reference_count: number;
  synthetic_pct: number;
  reference_pct: number;
  delta_pct: number;
}

export interface CategoricalDistributionComparison {
  column: string;
  total_unique_categories: number;
  synthetic_unique_count: number;
  reference_unique_count: number;
  total_variation_distance: number;
  categories: CategoricalCategoryRow[];
  missing_from_synthetic: string[];
  missing_from_reference: string[];
  rare_categories: string[];
  large_frequency_shifts: {
    category: string;
    synthetic_pct: number;
    reference_pct: number;
    delta_pct: number;
  }[];
}

export interface MissingnessComparison {
  column: string;
  synthetic_missing_count: number;
  reference_missing_count: number;
  synthetic_missing_pct: number;
  reference_missing_pct: number;
  difference_pct: number;
  is_substantial_discrepancy: boolean;
  observation: string;
}

export interface OutlierComparison {
  column: string;
  synthetic_outliers_count: number;
  reference_outliers_count: number;
  synthetic_outlier_pct: number;
  reference_outlier_pct: number;
  outlier_diff_pct: number;
  synthetic_bounds: { lower: number; upper: number };
  reference_bounds: { lower: number; upper: number };
  is_substantial_discrepancy: boolean;
  characterization: string;
}

export interface CorrelationDifference {
  pair: string;
  column_1: string;
  column_2: string;
  synthetic_correlation: number;
  reference_correlation: number;
  difference: number;
  relationship_status: 'Preserved' | 'Weakened' | 'Strengthened' | 'Divergent';
}

export interface CorrelationComparison {
  columns: string[];
  synthetic_matrix: Record<string, Record<string, number>>;
  reference_matrix: Record<string, Record<string, number>>;
  differences: CorrelationDifference[];
  preserved_ratio: number;
  total_pairs: number;
  preserved_pairs_count: number;
}

export interface PotentialDataIssue {
  category: 'Schema Issues' | 'Distribution Issues' | 'Data Quality Issues' | 'Relationship Issues';
  type: string;
  severity: 'Low' | 'Medium' | 'High';
  column: string;
  evidence: string;
  interpretation: string;
}

export interface RiskArea {
  category: 'Distribution Drift' | 'Missingness Mismatch' | 'Category Imbalance' | 'Outlier Mismatch' | 'Correlation Mismatch' | 'Schema Mismatch';
  severity: 'Low' | 'Medium' | 'High';
  affected_column: string;
  synthetic_value: string;
  reference_value: string;
  evidence: string;
  recommended_investigation: string;
}

export interface ValidationComparisonResult {
  id: string;
  timestamp: string;
  disclaimer: string;
  previews: {
    synthetic: DatasetFilePreview;
    reference: DatasetFilePreview;
  };
  schema_analysis: SchemaAnalysis;
  similarity_index: {
    index_value: number;
    label: string;
    contributing_components: {
      schema_alignment: number;
      numeric_distributions: number;
      categorical_fidelity: number;
      correlation_preservation: number;
      missingness_alignment: number;
    };
    interpretation_disclaimer: string;
  };
  executive_summary: {
    dataset_compatibility: string;
    numeric_summary: string;
    categorical_summary: string;
    missingness_summary: string;
    correlation_summary: string;
    key_findings: string[];
  };
  numeric_comparison: NumericDistributionComparison[];
  categorical_comparison: CategoricalDistributionComparison[];
  missing_comparison: MissingnessComparison[];
  outlier_comparison: OutlierComparison[];
  correlation_comparison: CorrelationComparison;
  potential_issues: PotentialDataIssue[];
  risk_areas: RiskArea[];
  recommendations: {
    suitable_for: string[];
    use_with_caution: string[];
  };
}
