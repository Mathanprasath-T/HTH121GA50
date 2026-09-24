import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { 
  Dataset, 
  DatasetRecord, 
  ValidationReport 
} from '../types';
import { 
  buildDatasetCsvString, 
  buildValidationReportMarkdownString, 
  buildAnomalyLogCsvString 
} from './exporter';

export interface CloudSaveResult {
  success: boolean;
  cloudDatasetId?: string;
  cloudJobId?: string;
  csvStoragePath?: string;
  anomalyStoragePath?: string;
  reportStoragePath?: string;
  error?: string;
}

export interface CloudDatasetSummary {
  id: string;
  name: string;
  domain: string;
  row_count: number;
  seed: number;
  created_at: string;
  csv_storage_path: string | null;
  anomaly_log_storage_path: string | null;
  validation_report_storage_path: string | null;
  validation: ValidationReport | null;
}

/**
 * Generate a standard UUID v4 string (browser and fallback compatible)
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Persist an entire dataset and its audit trails to Supabase Cloud:
 * 1. Inserts into generation_jobs (status: generating)
 * 2. Uploads raw CSV, anomaly audit CSV, and markdown validation report to Storage
 * 3. Inserts dataset metadata into datasets table
 * 4. Batch inserts rows into dataset_records (chunks of 500)
 * 5. Batch inserts edge cases into anomaly_logs (chunks of 500)
 * 6. Marks generation_job as completed
 */
export async function persistDatasetToCloud(
  dataset: Dataset,
  prompt?: string,
  source: 'gemini' | 'local' = 'local'
): Promise<CloudSaveResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase credentials are not configured in environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).'
    };
  }

  const cloudDatasetId = generateUuid();
  let cloudJobId: string | undefined;

  try {
    // -------------------------------------------------------------
    // STEP 1: Insert into generation_jobs
    // -------------------------------------------------------------
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('generation_jobs')
        .insert({
          prompt: prompt || dataset.specification?.prompt || `Generate ${dataset.rowCount} ${dataset.domain} records`,
          source: source,
          specification: dataset.specification,
          seed: dataset.seed,
          row_count: dataset.rowCount,
          status: 'generating'
        })
        .select('id')
        .single();

      if (!jobError && jobData) {
        cloudJobId = jobData.id;
      } else if (jobError) {
        console.warn('[Supabase] Warning creating generation_job:', jobError.message);
      }
    } catch (jobErr: any) {
      console.warn('[Supabase] Exception creating generation_job:', jobErr?.message);
    }

    // -------------------------------------------------------------
    // STEP 2: Upload Files to Supabase Storage (datasets and reports)
    // -------------------------------------------------------------
    let csvStoragePath: string | null = null;
    let anomalyStoragePath: string | null = null;
    let reportStoragePath: string | null = null;

    try {
      // 2a. Dataset CSV
      const csvContent = buildDatasetCsvString(dataset);
      if (csvContent) {
        const path = `${cloudDatasetId}/dataset.csv`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const { error: uploadErr } = await supabase.storage
          .from('datasets')
          .upload(path, blob, { contentType: 'text/csv', upsert: true });

        if (!uploadErr) {
          csvStoragePath = path;
        } else {
          console.warn('[Supabase Storage] dataset.csv upload notice:', uploadErr.message);
        }
      }

      // 2b. Anomaly Audit Log CSV
      if (dataset.anomalyLogs && dataset.anomalyLogs.length > 0) {
        const anomalyCsv = buildAnomalyLogCsvString(dataset.anomalyLogs);
        const path = `${cloudDatasetId}/anomaly-log.csv`;
        const blob = new Blob([anomalyCsv], { type: 'text/csv;charset=utf-8;' });
        const { error: anomUploadErr } = await supabase.storage
          .from('datasets')
          .upload(path, blob, { contentType: 'text/csv', upsert: true });

        if (!anomUploadErr) {
          anomalyStoragePath = path;
        } else {
          console.warn('[Supabase Storage] anomaly-log.csv upload notice:', anomUploadErr.message);
        }
      }

      // 2c. Validation Markdown Report
      if (dataset.validationReport) {
        const reportMd = buildValidationReportMarkdownString(dataset.validationReport, dataset);
        const path = `${cloudDatasetId}/validation-report.md`;
        const blob = new Blob([reportMd], { type: 'text/markdown;charset=utf-8;' });
        const { error: repUploadErr } = await supabase.storage
          .from('reports')
          .upload(path, blob, { contentType: 'text/markdown', upsert: true });

        if (!repUploadErr) {
          reportStoragePath = path;
        } else {
          console.warn('[Supabase Storage] validation-report.md upload notice:', repUploadErr.message);
        }
      }
    } catch (storageErr: any) {
      console.warn('[Supabase Storage] Storage upload exception (continuing database save):', storageErr?.message);
    }

    // -------------------------------------------------------------
    // STEP 3: Insert dataset metadata into public.datasets
    // -------------------------------------------------------------
    const datasetPayload = {
      id: cloudDatasetId,
      generation_job_id: cloudJobId || null,
      name: dataset.name,
      domain: dataset.domain,
      row_count: dataset.rowCount,
      seed: dataset.seed,
      specification: dataset.specification,
      validation: dataset.validationReport,
      created_at: dataset.createdAt || new Date().toISOString(),
      csv_storage_path: csvStoragePath,
      anomaly_log_storage_path: anomalyStoragePath,
      validation_report_storage_path: reportStoragePath
    };

    const { error: datasetInsertErr } = await supabase
      .from('datasets')
      .insert(datasetPayload);

    if (datasetInsertErr) {
      throw new Error(`Failed to insert into datasets table: ${datasetInsertErr.message}`);
    }

    // -------------------------------------------------------------
    // STEP 4: Batch insert records into dataset_records (chunks of 500)
    // -------------------------------------------------------------
    if (dataset.records && dataset.records.length > 0) {
      const recordsBatchSize = 500;
      const totalRecords = dataset.records.length;

      for (let i = 0; i < totalRecords; i += recordsBatchSize) {
        const chunk = dataset.records.slice(i, i + recordsBatchSize);
        const recordsPayload = chunk.map((rec, idx) => ({
          dataset_id: cloudDatasetId,
          row_number: i + idx + 1,
          record: rec
        }));

        const { error: batchErr } = await supabase
          .from('dataset_records')
          .insert(recordsPayload);

        if (batchErr) {
          console.warn(`[Supabase] Batch insert warning at chunk [${i}..${i + chunk.length}]:`, batchErr.message);
          // We continue to give best-effort persistence rather than throwing
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 5: Batch insert anomaly audit logs (chunks of 500)
    // -------------------------------------------------------------
    if (dataset.anomalyLogs && dataset.anomalyLogs.length > 0) {
      const anomBatchSize = 500;
      for (let i = 0; i < dataset.anomalyLogs.length; i += anomBatchSize) {
        const chunk = dataset.anomalyLogs.slice(i, i + anomBatchSize);
        const anomPayload = chunk.map(log => ({
          dataset_id: cloudDatasetId,
          row_number: log.rowId,
          anomaly_type: log.type,
          target_column: log.column,
          original_value: log.originalValue !== undefined ? log.originalValue : null,
          mutated_value: log.injectedValue !== undefined ? log.injectedValue : null,
          severity: log.severity,
          formula: log.ruleFormula,
          created_at: log.timestamp || new Date().toISOString()
        }));

        const { error: anomErr } = await supabase
          .from('anomaly_logs')
          .insert(anomPayload);

        if (anomErr) {
          console.warn(`[Supabase] Anomaly logs batch insert warning:`, anomErr.message);
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 6: Mark generation_job as completed
    // -------------------------------------------------------------
    if (cloudJobId) {
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', cloudJobId);
    }

    return {
      success: true,
      cloudDatasetId,
      cloudJobId,
      csvStoragePath: csvStoragePath || undefined,
      anomalyStoragePath: anomalyStoragePath || undefined,
      reportStoragePath: reportStoragePath || undefined
    };

  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown Supabase persistence error';
    console.error('[Supabase Service] Failed to persist dataset to cloud:', errorMsg);

    // If a job was created, flag it as failed
    if (cloudJobId) {
      try {
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString()
          })
          .eq('id', cloudJobId);
      } catch {
        // ignore secondary failure
      }
    }

    return {
      success: false,
      error: errorMsg,
      cloudJobId
    };
  }
}

/**
 * Retrieve list of datasets stored in Supabase Cloud
 */
export async function getCloudDatasets(): Promise<CloudDatasetSummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, domain, row_count, seed, created_at, csv_storage_path, anomaly_log_storage_path, validation_report_storage_path, validation')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Failed to fetch cloud datasets:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error listing cloud datasets:', err);
    return [];
  }
}

/**
 * Retrieve a signed download URL for an artifact in Supabase Storage
 */
export async function getCloudArtifactDownloadUrl(
  path: string, 
  bucket: 'datasets' | 'reports' = 'datasets',
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      // Fallback to public URL in case bucket is public
      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      return pub.data?.publicUrl || null;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Failed to get signed URL:', err);
    return null;
  }
}

/**
 * Download a CSV file directly from Supabase Storage and trigger browser save
 */
export async function downloadCloudDatasetCsv(
  storagePath: string, 
  suggestedFilename = 'cloud_dataset.csv'
): Promise<boolean> {
  if (!isSupabaseConfigured() || !storagePath) return false;

  try {
    const { data, error } = await supabase.storage
      .from('datasets')
      .download(storagePath);

    if (error || !data) {
      console.warn('[Supabase Storage] Download failed:', error?.message);
      return false;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.warn('[Supabase Storage] Error downloading blob:', err);
    return false;
  }
}

/**
 * Paginated retrieval of dataset records from Supabase Cloud table dataset_records
 */
export async function getCloudDatasetRecords(
  cloudDatasetId: string, 
  page = 1, 
  pageSize = 50
): Promise<{ records: DatasetRecord[]; totalCount: number }> {
  if (!isSupabaseConfigured() || !cloudDatasetId) {
    return { records: [], totalCount: 0 };
  }

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('dataset_records')
      .select('row_number, record', { count: 'exact' })
      .eq('dataset_id', cloudDatasetId)
      .order('row_number', { ascending: true })
      .range(from, to);

    if (error || !data) {
      console.warn('[Supabase] Failed to get dataset records:', error?.message);
      return { records: [], totalCount: 0 };
    }

    const records: DatasetRecord[] = data.map(item => item.record);
    return { records, totalCount: count || records.length };
  } catch (err) {
    console.warn('[Supabase] Error querying dataset_records:', err);
    return { records: [], totalCount: 0 };
  }
}
