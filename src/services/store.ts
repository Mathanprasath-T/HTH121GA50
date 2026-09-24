import type { 
  Dataset, 
  ActivityItem, 
  StressTestResult, 
  AnomalyLog
} from '../types';
import { idb } from './indexedDb';
import { runValidationSuite } from './validator';
import { PRNG } from './generatorEngine';

const STORAGE_KEY_ACTIVITIES = 'syntheticlab_activities_v1';
const STORAGE_KEY_STRESS_TESTS = 'syntheticlab_stress_tests_v1';

export interface GlobalMetrics {
  totalDatasets: number;
  totalRowsGenerated: number;
  validationPassRate: number;
  totalAnomaliesInjected: number;
}

class StoreService {
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  async getAllDatasets(): Promise<Omit<Dataset, 'records'>[]> {
    try {
      const list = await idb.getAllDatasetsMetadata();
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  async getDatasetById(id: string): Promise<Dataset | null> {
    try {
      return await idb.getDataset(id);
    } catch {
      return null;
    }
  }

  async saveDataset(dataset: Dataset): Promise<void> {
    await idb.saveDataset(dataset);
    this.logActivity(
      'DATASET_GENERATED',
      dataset.name,
      `Generated ${dataset.rowCount.toLocaleString()} rows with seed [${dataset.seed}] across ${dataset.specification.schema.length} fields in ${dataset.generationDurationMs}ms`,
      dataset.id
    );
    this.notify();
  }

  async updateDatasetCloudMetadata(
    id: string, 
    cloudUpdates: Partial<Dataset>
  ): Promise<void> {
    await idb.updateDatasetMetadata({ id, ...cloudUpdates });
    if (cloudUpdates.cloudStatus === 'CLOUD_SAVED') {
      const ds = await this.getDatasetById(id);
      this.logActivity(
        'REPORT_CREATED',
        ds?.name || 'Dataset',
        `Cloud sync complete: stored in Supabase with Storage assets`,
        id
      );
    }
    this.notify();
  }

  async deleteDataset(id: string): Promise<void> {
    const ds = await this.getDatasetById(id);
    await idb.deleteDataset(id);
    if (ds) {
      this.logActivity(
        'DATASET_EXPORTED',
        ds.name,
        `Purged dataset record and associated audit partitions`,
        id
      );
    }
    this.notify();
  }

  async getGlobalMetrics(): Promise<GlobalMetrics> {
    const datasets = await this.getAllDatasets();
    if (datasets.length === 0) {
      return {
        totalDatasets: 0,
        totalRowsGenerated: 0,
        validationPassRate: 0,
        totalAnomaliesInjected: 0
      };
    }

    const totalDatasets = datasets.length;
    let totalRowsGenerated = 0;
    let totalChecks = 0;
    let passedChecks = 0;
    let totalAnomaliesInjected = 0;

    datasets.forEach(ds => {
      totalRowsGenerated += ds.rowCount || 0;
      if (ds.validationReport) {
        totalChecks += ds.validationReport.totalChecks || 0;
        passedChecks += ds.validationReport.passedChecks || 0;
      }
      if (Array.isArray(ds.anomalyLogs)) {
        totalAnomaliesInjected += ds.anomalyLogs.length;
      }
    });

    const validationPassRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 1000) / 10 : 0;

    return {
      totalDatasets,
      totalRowsGenerated,
      validationPassRate,
      totalAnomaliesInjected
    };
  }

  getActivityFeed(): ActivityItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  logActivity(
    action: ActivityItem['action'],
    target: string,
    details: string,
    datasetId?: string
  ): void {
    try {
      const current = this.getActivityFeed();
      const newItem: ActivityItem = {
        id: `act_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
        action,
        target,
        datasetId,
        timestamp: new Date().toISOString(),
        details
      };
      const updated = [newItem, ...current].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to log activity', e);
    }
  }

  getStressTests(): StressTestResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STRESS_TESTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveStressTest(result: StressTestResult): void {
    const list = this.getStressTests();
    const updated = [result, ...list].slice(0, 30);
    localStorage.setItem(STORAGE_KEY_STRESS_TESTS, JSON.stringify(updated));
    this.notify();
  }

  async applyControlledAnomalies(
    datasetId: string,
    targets: {
      missingRatePct: number;
      extremeRatePct: number;
      duplicateRatePct: number;
      invalidDateRatePct: number;
      rareCategoryRatePct: number;
    }
  ): Promise<Dataset | null> {
    const dataset = await this.getDatasetById(datasetId);
    if (!dataset) return null;

    const prng = new PRNG(dataset.seed + 9999);
    const records = dataset.records;
    const totalRows = records.length;
    const newLogs: AnomalyLog[] = [...dataset.anomalyLogs];

    // 1. Extreme Values
    const extremeCount = Math.round((targets.extremeRatePct / 100) * totalRows);
    for (let i = 0; i < extremeCount; i++) {
      const rowIdx = prng.nextInt(0, totalRows - 1);
      const row = records[rowIdx];
      if (row) {
        const col = row['amount'] !== undefined ? 'amount' : (row['temperature_c'] !== undefined ? 'temperature_c' : 'mrr_amount');
        const orig = row[col];
        const mult = prng.nextFloat(10.0, 35.0);
        const injected = Math.round(orig * mult * 100) / 100;
        row[col] = injected;
        row._hasAnomaly = true;
        if (!row._anomalyTypes.includes('EXTREME_VALUE')) row._anomalyTypes.push('EXTREME_VALUE');

        newLogs.push({
          id: `anom_lab_${Date.now().toString(36)}_${i}`,
          rowId: row._rowId,
          type: 'EXTREME_VALUE',
          column: col,
          originalValue: orig,
          injectedValue: injected,
          severity: 'HIGH',
          reason: `Anomaly Lab injection: Outlier scaling factor of ${mult.toFixed(1)}x`,
          ruleFormula: `val = orig * [10.0 - 35.0]`,
          timestamp: new Date().toISOString(),
          datasetId
        });
      }
    }

    // 2. Missing Values (Null)
    const missingCount = Math.round((targets.missingRatePct / 100) * totalRows);
    for (let i = 0; i < missingCount; i++) {
      const rowIdx = prng.nextInt(0, totalRows - 1);
      const row = records[rowIdx];
      if (row) {
        const nullCol = row['customer_email'] !== undefined ? 'customer_email'
          : row['swift_bic'] !== undefined ? 'swift_bic'
          : row['battery_level_pct'] !== undefined ? 'battery_level_pct'
          : 'tenure_months';
        const orig = row[nullCol];
        row[nullCol] = null;
        row._hasAnomaly = true;
        if (!row._anomalyTypes.includes('MISSING_NULL')) row._anomalyTypes.push('MISSING_NULL');

        newLogs.push({
          id: `anom_lab_${Date.now().toString(36)}_${i}_null`,
          rowId: row._rowId,
          type: 'MISSING_NULL',
          column: nullCol,
          originalValue: orig,
          injectedValue: 'null (MISSING)',
          severity: 'LOW',
          reason: 'Anomaly Lab: Injected null dropout tripwire',
          ruleFormula: `col.${nullCol} := NULL`,
          timestamp: new Date().toISOString(),
          datasetId
        });
      }
    }

    // 3. Duplicate Keys
    const duplicateCount = Math.round((targets.duplicateRatePct / 100) * totalRows);
    for (let i = 0; i < duplicateCount; i++) {
      const sourceIdx = prng.nextInt(0, 50);
      const targetIdx = prng.nextInt(51, totalRows - 1);
      if (records[sourceIdx] && records[targetIdx]) {
        const src = records[sourceIdx];
        const tgt = records[targetIdx];
        const keyCol = src['transaction_id'] ? 'transaction_id' 
          : src['transfer_id'] ? 'transfer_id' : 'reading_id';
        const orig = tgt[keyCol];
        tgt[keyCol] = src[keyCol];
        tgt._hasAnomaly = true;
        if (!tgt._anomalyTypes.includes('DUPLICATE_KEY')) tgt._anomalyTypes.push('DUPLICATE_KEY');

        newLogs.push({
          id: `anom_lab_${Date.now().toString(36)}_${i}_dup`,
          rowId: tgt._rowId,
          type: 'DUPLICATE_KEY',
          column: keyCol,
          originalValue: orig,
          injectedValue: src[keyCol],
          severity: 'CRITICAL',
          reason: `Anomaly Lab: Primary key duplicate injection copying row #${src._rowId}`,
          ruleFormula: `target.${keyCol} := source.${keyCol}`,
          timestamp: new Date().toISOString(),
          datasetId
        });
      }
    }

    // 4. Invalid Dates
    const invalidCount = Math.round((targets.invalidDateRatePct / 100) * totalRows);
    for (let i = 0; i < invalidCount; i++) {
      const rowIdx = prng.nextInt(0, totalRows - 1);
      const row = records[rowIdx];
      if (row) {
        const orig = row['timestamp'];
        row['timestamp'] = '2026-02-31T25:61:99.000Z';
        row._hasAnomaly = true;
        if (!row._anomalyTypes.includes('INVALID_DATE')) row._anomalyTypes.push('INVALID_DATE');

        newLogs.push({
          id: `anom_lab_${Date.now().toString(36)}_${i}_date`,
          rowId: row._rowId,
          type: 'INVALID_DATE',
          column: 'timestamp',
          originalValue: orig,
          injectedValue: '2026-02-31T25:61:99.000Z',
          severity: 'MEDIUM',
          reason: 'Anomaly Lab: Malformed timestamp injection',
          ruleFormula: `timestamp := '2026-02-31T25:61:99.000Z'`,
          timestamp: new Date().toISOString(),
          datasetId
        });
      }
    }

    // Update spec edge cases with new injected figures
    const updatedSpec = {
      ...dataset.specification,
      edgeCases: {
        ...dataset.specification.edgeCases,
        extremeValuesRate: targets.extremeRatePct,
        missingValuesRate: targets.missingRatePct,
        duplicateRate: targets.duplicateRatePct,
        invalidDatesRate: targets.invalidDateRatePct,
      }
    };

    // Re-run validation suite
    const updatedValidation = runValidationSuite(datasetId, updatedSpec, records, newLogs);

    const updatedDataset: Dataset = {
      ...dataset,
      specification: updatedSpec,
      records,
      anomalyLogs: newLogs,
      validationReport: updatedValidation
    };

    await idb.saveDataset(updatedDataset);
    this.logActivity(
      'ANOMALIES_APPLIED',
      dataset.name,
      `Injected ${extremeCount + missingCount + duplicateCount + invalidCount} anomalies via Anomaly Lab into ${dataset.name}`,
      datasetId
    );
    this.notify();
    return updatedDataset;
  }

  async clearAllData(): Promise<void> {
    await idb.clearAll();
    localStorage.removeItem(STORAGE_KEY_ACTIVITIES);
    localStorage.removeItem(STORAGE_KEY_STRESS_TESTS);
    this.notify();
  }
}

export const store = new StoreService();
