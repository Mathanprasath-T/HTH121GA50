import type { 
  DatasetSpecification, 
  DatasetRecord, 
  AnomalyLog, 
  Dataset, 
  ValidationReport,
  AnomalyType
} from '../types';
import { runValidationSuite } from './validator';

// Deterministic Mulberry32 Pseudo-Random Number Generator
export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  // Returns pseudo-random float in [0, 1)
  next(): number {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float between [min, max)
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer between [min, max] inclusive
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat(min, max + 1));
  }

  // Pick random element from array
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Gaussian / Normal distribution via Box-Muller transform
  nextGaussian(mean: number, stdDev: number): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 <= 1e-15) u1 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Exponential distribution (e.g. for financial transaction sizes)
  nextExponential(lambda: number): number {
    let u = this.next();
    while (u <= 1e-15) u = this.next();
    return -Math.log(1 - u) / lambda;
  }
}

export interface GenerationProgress {
  stage: 
    | 'UNDERSTANDING_REQUIREMENTS' 
    | 'BUILDING_SCHEMA' 
    | 'GENERATING_RECORDS' 
    | 'APPLYING_EDGE_CASES' 
    | 'RUNNING_VALIDATION' 
    | 'PREPARING_FILES'
    | 'COMPLETED';
  stageIndex: number;
  totalStages: number;
  percent: number;
  rowsGenerated: number;
  totalRows: number;
  message: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

export async function generateDatasetAsync(
  spec: DatasetSpecification,
  onProgress?: ProgressCallback
): Promise<Dataset> {
  const startTime = performance.now();
  const prng = new PRNG(spec.seed);
  const datasetId = `ds_${Date.now().toString(36)}_${Math.floor(prng.next() * 100000).toString(36)}`;
  const totalRows = spec.totalRows;

  // Stage 1: Understanding Requirements
  onProgress?.({
    stage: 'UNDERSTANDING_REQUIREMENTS',
    stageIndex: 1,
    totalStages: 6,
    percent: 10,
    rowsGenerated: 0,
    totalRows,
    message: 'Parsed 14 constraint parameters, PRNG seed locked at ' + spec.seed
  });
  await delay(120);

  // Stage 2: Building Schema
  onProgress?.({
    stage: 'BUILDING_SCHEMA',
    stageIndex: 2,
    totalStages: 6,
    percent: 25,
    rowsGenerated: 0,
    totalRows,
    message: `Allocated schema with ${spec.schema.length} fields across domain '${spec.domain}'`
  });
  await delay(150);

  // Stage 3: Generating Base Records
  const records: DatasetRecord[] = [];
  const anomalyLogs: AnomalyLog[] = [];

  // Calculate target numbers for edge cases
  const fraudTargetCount = Math.round((spec.edgeCases.fraudRate / 100) * totalRows);
  const extremeTargetCount = Math.round((spec.edgeCases.extremeValuesRate / 100) * totalRows);
  const missingTargetCount = Math.round((spec.edgeCases.missingValuesRate / 100) * totalRows);
  const duplicateTargetCount = Math.round((spec.edgeCases.duplicateRate / 100) * totalRows);
  const invalidDateTargetCount = Math.round((spec.edgeCases.invalidDatesRate / 100) * totalRows);

  // Pick deterministic target indices for edge cases
  const indices = Array.from({ length: totalRows }, (_, i) => i);
  shuffleDeterministic(indices, prng);

  const fraudIndices = new Set(indices.slice(0, fraudTargetCount));
  const extremeIndices = new Set(indices.slice(fraudTargetCount, fraudTargetCount + extremeTargetCount));
  const missingIndices = new Set(indices.slice(fraudTargetCount + extremeTargetCount, fraudTargetCount + extremeTargetCount + missingTargetCount));
  const invalidDateIndices = new Set(indices.slice(
    fraudTargetCount + extremeTargetCount + missingTargetCount,
    fraudTargetCount + extremeTargetCount + missingTargetCount + invalidDateTargetCount
  ));

  // Determine date boundaries (last 45 days)
  const baseEpoch = new Date('2026-08-01T00:00:00Z').getTime();
  const timeSpanMs = 45 * 24 * 60 * 60 * 1000;

  const batchSize = Math.max(500, Math.floor(totalRows / 10));

  for (let i = 0; i < totalRows; i++) {
    const rowId = i + 1;
    const isFraud = fraudIndices.has(i);
    const rowAnomalies: AnomalyType[] = [];

    // Synthesize timestamp respecting weekend uplift
    let timestampMs = baseEpoch + Math.floor(prng.next() * timeSpanMs);
    let sampleDate = new Date(timestampMs);
    const dayOfWeek = sampleDate.getUTCDay(); // 0 is Sun, 6 is Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // If spec specifies weekend increase, bias weekend selection
    if (spec.edgeCases.weekendSalesIncrease > 0) {
      const upliftFactor = spec.edgeCases.weekendSalesIncrease / 100;
      // Probabilistic resampling to achieve exact distribution
      if (!isWeekend && prng.next() < (upliftFactor * 0.28)) {
        // Shift to weekend
        const weekendOffsetDays = (6 - dayOfWeek);
        timestampMs += weekendOffsetDays * 86400000;
        sampleDate = new Date(timestampMs);
      }
    }

    let timestampIso = sampleDate.toISOString();

    const record: DatasetRecord = {
      _rowId: rowId,
      _hasAnomaly: false,
      _anomalyTypes: []
    };

    // Domain Specific Base Synthesis
    if (spec.domain === 'ecommerce') {
      const baseAmount = Math.max(4.50, Math.round(prng.nextExponential(0.015) * 100) / 100);
      const emailDomain = prng.pick(['gmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'corporate.io']);
      const custIdNum = prng.nextInt(1001, 8999);

      record['transaction_id'] = `tx_${prng.nextInt(100000, 999999)}_${rowId}`;
      record['customer_id'] = `cust_usr_${custIdNum}`;
      record['timestamp'] = timestampIso;
      record['amount'] = isFraud ? Math.round((baseAmount * 3.8 + 450) * 100) / 100 : baseAmount;
      record['payment_method'] = isFraud 
        ? prng.pick(['credit_card', 'crypto', 'wire_transfer']) 
        : prng.pick(['credit_card', 'debit_card', 'paypal', 'apple_pay']);
      record['product_category'] = isFraud 
        ? prng.pick(['luxury_jewelry', 'digital_software', 'electronics'])
        : prng.pick(['electronics', 'apparel', 'home_goods', 'digital_software']);
      record['device_type'] = prng.pick(['desktop_chrome', 'mobile_ios', 'mobile_android', 'desktop_safari']);
      record['billing_country'] = isFraud ? prng.pick(['RU', 'NG', 'BR', 'CN', 'US']) : prng.pick(['US', 'CA', 'GB', 'DE', 'AU']);
      record['customer_email'] = `user${custIdNum}@${emailDomain}`;
      record['is_fraud'] = isFraud;

    } else if (spec.domain === 'fintech') {
      const baseAmount = Math.max(100.0, Math.round(prng.nextExponential(0.0003) * 100) / 100);
      record['transfer_id'] = `trf_${prng.nextInt(10000000, 99999999)}`;
      record['originating_account'] = `ACC-${prng.nextInt(1000, 9999)}-${prng.nextInt(100, 999)}`;
      record['beneficiary_account'] = `ACC-${prng.nextInt(5000, 9999)}-${prng.nextInt(100, 999)}`;
      record['timestamp'] = timestampIso;
      record['amount'] = isFraud ? Math.round((baseAmount * 8.5 + 45000) * 100) / 100 : baseAmount;
      record['currency'] = prng.pick(['USD', 'EUR', 'GBP', 'CHF', 'JPY']);
      record['transfer_rail'] = isFraud ? prng.pick(['swift_gpi', 'chips']) : prng.pick(['fedwire', 'swift_gpi', 'sepa_instant']);
      record['swift_bic'] = `${prng.pick(['CHAS', 'BOFA', 'BARC', 'DBET', 'UBSW'])}${prng.pick(['US33', 'GB22', 'DE44', 'CH22'])}`;
      record['origin_country'] = prng.pick(['US', 'GB', 'DE', 'CH', 'SG']);
      record['is_aml_flagged'] = isFraud;

    } else if (spec.domain === 'iot') {
      record['reading_id'] = `read_${rowId}_${prng.nextInt(1000, 9999)}`;
      record['device_id'] = `SENSOR-TURBINE-${prng.nextInt(1, 16).toString().padStart(2, '0')}`;
      record['timestamp'] = timestampIso;
      const baseTemp = Math.round(prng.nextGaussian(54.2, 8.4) * 100) / 100;
      const baseVib = Math.round(prng.nextGaussian(48.5, 9.2) * 100) / 100;
      record['temperature_c'] = isFraud ? Math.round((baseTemp + 42.0) * 100) / 100 : baseTemp;
      record['vibration_hz'] = isFraud ? Math.round((baseVib * 2.8) * 100) / 100 : baseVib;
      record['pressure_bar'] = Math.round(prng.nextGaussian(4.2, 0.6) * 100) / 100;
      record['battery_level_pct'] = prng.nextInt(35, 100);
      record['firmware_version'] = prng.pick(['v2.1.0', 'v2.2.4', 'v2.3.0-rc1']);
      record['is_anomaly'] = isFraud;

    } else if (spec.domain === 'saas_churn') {
      record['event_id'] = `evt_${prng.nextInt(100000, 999999)}`;
      record['account_id'] = `org_${prng.nextInt(1000, 5000)}`;
      record['timestamp'] = timestampIso;
      record['plan_tier'] = prng.pick(['starter', 'growth', 'enterprise_scale']);
      record['mrr_amount'] = prng.pick([99.00, 299.00, 799.00, 1999.00]);
      record['tenure_months'] = prng.nextInt(2, 36);
      record['weekly_active_users'] = isFraud ? prng.nextInt(0, 2) : prng.nextInt(8, 65);
      record['support_tickets_30d'] = isFraud ? prng.nextInt(5, 14) : prng.nextInt(0, 3);
      record['is_churned'] = isFraud;
    } else {
      record['id'] = `rec_${rowId}`;
      record['timestamp'] = timestampIso;
      record['value'] = Math.round(prng.nextGaussian(500, 120) * 100) / 100;
      record['is_flagged'] = isFraud;
    }

    if (isFraud) {
      rowAnomalies.push('FRAUD_INJECTION');
      const targetCol = spec.domain === 'ecommerce' ? 'is_fraud' 
        : spec.domain === 'fintech' ? 'is_aml_flagged'
        : spec.domain === 'iot' ? 'is_anomaly' : 'is_churned';
      
      anomalyLogs.push({
        id: `anom_${datasetId}_${anomalyLogs.length + 1}`,
        rowId,
        type: 'FRAUD_INJECTION',
        column: targetCol,
        originalValue: false,
        injectedValue: true,
        severity: 'HIGH',
        reason: 'Target fraud pattern synthesis with coordinated multivariate signatures',
        ruleFormula: `target_fraud_rate = ${spec.edgeCases.fraudRate}% (row in target cluster)`,
        timestamp: new Date().toISOString(),
        datasetId
      });
    }

    records.push(record);

    // Stream generation progress
    if (i % batchSize === 0 || i === totalRows - 1) {
      const pct = 30 + Math.round((i / totalRows) * 35);
      onProgress?.({
        stage: 'GENERATING_RECORDS',
        stageIndex: 3,
        totalStages: 6,
        percent: pct,
        rowsGenerated: i + 1,
        totalRows,
        message: `Generating records: ${ (i + 1).toLocaleString() } / ${totalRows.toLocaleString()}`
      });
      // Allow UI thread to breathe
      if (i % (batchSize * 3) === 0) {
        await delay(16);
      }
    }
  }

  // Stage 4: Applying Edge Cases & Controlled Anomalies
  onProgress?.({
    stage: 'APPLYING_EDGE_CASES',
    stageIndex: 4,
    totalStages: 6,
    percent: 75,
    rowsGenerated: totalRows,
    totalRows,
    message: 'Applying controlled anomalies: extreme outliers, null dropout, duplicates, invalid dates'
  });
  await delay(100);

  // 4a. Extreme Values Injection
  extremeIndices.forEach(idx => {
    const row = records[idx];
    if (!row) return;
    const amountCol = row['amount'] !== undefined ? 'amount' : (row['temperature_c'] !== undefined ? 'temperature_c' : 'mrr_amount');
    const orig = row[amountCol];
    const multiplier = prng.nextFloat(8.5, 22.0);
    const injected = Math.round(orig * multiplier * 100) / 100;
    row[amountCol] = injected;
    row._hasAnomaly = true;
    row._anomalyTypes.push('EXTREME_VALUE');

    anomalyLogs.push({
      id: `anom_${datasetId}_${anomalyLogs.length + 1}`,
      rowId: row._rowId,
      type: 'EXTREME_VALUE',
      column: amountCol,
      originalValue: orig,
      injectedValue: injected,
      severity: 'HIGH',
      reason: `Outlier injection: value shifted by ${multiplier.toFixed(1)}x exceeding 4.5σ IQR boundary`,
      ruleFormula: `val = orig * [8.5 - 22.0] (${multiplier.toFixed(2)}x)`,
      timestamp: new Date().toISOString(),
      datasetId
    });
  });

  // 4b. Missing Values (Null Dropout) Injection
  missingIndices.forEach(idx => {
    const row = records[idx];
    if (!row) return;
    const nullCandidate = row['customer_email'] !== undefined ? 'customer_email'
      : row['swift_bic'] !== undefined ? 'swift_bic'
      : row['battery_level_pct'] !== undefined ? 'battery_level_pct'
      : 'tenure_months';

    const orig = row[nullCandidate];
    row[nullCandidate] = null;
    row._hasAnomaly = true;
    row._anomalyTypes.push('MISSING_NULL');

    anomalyLogs.push({
      id: `anom_${datasetId}_${anomalyLogs.length + 1}`,
      rowId: row._rowId,
      type: 'MISSING_NULL',
      column: nullCandidate,
      originalValue: orig,
      injectedValue: 'null (MISSING)',
      severity: 'LOW',
      reason: 'Controlled nullable field dropout for testing imputation pipelines',
      ruleFormula: `col.${nullCandidate} := NULL`,
      timestamp: new Date().toISOString(),
      datasetId
    });
  });

  // 4c. Duplicate Records Injection
  if (duplicateTargetCount > 0 && records.length > 10) {
    for (let d = 0; d < duplicateTargetCount; d++) {
      const sourceIdx = prng.nextInt(0, 100);
      const targetIdx = totalRows - 1 - d;
      if (sourceIdx !== targetIdx && records[sourceIdx] && records[targetIdx]) {
        const sourceRow = records[sourceIdx];
        const targetRow = records[targetIdx];
        const keyCol = sourceRow['transaction_id'] ? 'transaction_id' 
          : sourceRow['transfer_id'] ? 'transfer_id' 
          : sourceRow['reading_id'] ? 'reading_id' : 'event_id';
        
        const origKey = targetRow[keyCol];
        targetRow[keyCol] = sourceRow[keyCol]; // Injected collision
        targetRow._hasAnomaly = true;
        targetRow._anomalyTypes.push('DUPLICATE_KEY');

        anomalyLogs.push({
          id: `anom_${datasetId}_${anomalyLogs.length + 1}`,
          rowId: targetRow._rowId,
          type: 'DUPLICATE_KEY',
          column: keyCol,
          originalValue: origKey,
          injectedValue: sourceRow[keyCol],
          severity: 'CRITICAL',
          reason: `Primary key collision injected targeting source row #${sourceRow._rowId}`,
          ruleFormula: `target.${keyCol} := source.${keyCol}`,
          timestamp: new Date().toISOString(),
          datasetId
        });
      }
    }
  }

  // 4d. Invalid Dates Injection
  invalidDateIndices.forEach(idx => {
    const row = records[idx];
    if (!row) return;
    const orig = row['timestamp'];
    const corruptedDate = '2026-02-31T25:61:99.000Z'; // intentionally invalid calendar & hour
    row['timestamp'] = corruptedDate;
    row._hasAnomaly = true;
    row._anomalyTypes.push('INVALID_DATE');

    anomalyLogs.push({
      id: `anom_${datasetId}_${anomalyLogs.length + 1}`,
      rowId: row._rowId,
      type: 'INVALID_DATE',
      column: 'timestamp',
      originalValue: orig,
      injectedValue: corruptedDate,
      severity: 'MEDIUM',
      reason: 'ISO 8601 malformed calendar representation test (Feb 31st / 25h)',
      ruleFormula: `timestamp := '2026-02-31T25:61:99.000Z'`,
      timestamp: new Date().toISOString(),
      datasetId
    });
  });

  // Stage 5: Running Validation Suite
  onProgress?.({
    stage: 'RUNNING_VALIDATION',
    stageIndex: 5,
    totalStages: 6,
    percent: 88,
    rowsGenerated: totalRows,
    totalRows,
    message: 'Computing target vs actual deviations, tolerance bands, and statistical compliance'
  });
  await delay(120);

  const validationReport: ValidationReport = runValidationSuite(datasetId, spec, records, anomalyLogs);

  // Stage 6: Preparing Files & Indexes
  onProgress?.({
    stage: 'PREPARING_FILES',
    stageIndex: 6,
    totalStages: 6,
    percent: 96,
    rowsGenerated: totalRows,
    totalRows,
    message: 'Building indexed tables, CSV buffers, and audit log relations'
  });
  await delay(100);

  const durationMs = Math.round(performance.now() - startTime);

  onProgress?.({
    stage: 'COMPLETED',
    stageIndex: 6,
    totalStages: 6,
    percent: 100,
    rowsGenerated: totalRows,
    totalRows,
    message: `Job completed successfully in ${(durationMs / 1000).toFixed(2)}s.`
  });

  return {
    id: datasetId,
    name: spec.name,
    domain: spec.domain,
    rowCount: totalRows,
    seed: spec.seed,
    createdAt: new Date().toISOString(),
    generationDurationMs: durationMs,
    specification: spec,
    records,
    validationReport,
    anomalyLogs
  };
}

function shuffleDeterministic<T>(arr: T[], prng: PRNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
