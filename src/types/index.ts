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
