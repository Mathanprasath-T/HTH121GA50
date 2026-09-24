-- ==============================================================================
-- SyntheticLab — Supabase Cloud Database & Storage Schema
-- ==============================================================================
-- This migration script creates the tables, indexes, storage buckets, and RLS 
-- policies for persisting SyntheticLab synthetic datasets, anomaly audits,
-- validation reports, and raw binned records.
--
-- RUN IN SUPABASE SQL EDITOR:
-- 1. Open your Supabase project dashboard (https://supabase.com/dashboard)
-- 2. Navigate to "SQL Editor" -> "New query"
-- 3. Paste this entire file and click "Run"
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE: generation_jobs
-- Represents the user's natural-language or local dataset generation request.
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gemini', 'local')),
    specification JSONB NOT NULL,
    seed INTEGER NOT NULL,
    row_count INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('generating', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    error_message TEXT NULL
);

-- 3. TABLE: datasets
-- Stores high-level metadata, domain specification, and validation outcomes.
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_job_id UUID REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
    name TEXT,
    domain TEXT,
    row_count INTEGER,
    seed INTEGER,
    specification JSONB,
    validation JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    csv_storage_path TEXT,
    anomaly_log_storage_path TEXT,
    validation_report_storage_path TEXT
);

-- Index for sorting history
CREATE INDEX IF NOT EXISTS datasets_created_at_idx ON public.datasets(created_at DESC);

-- 4. TABLE: dataset_records
-- Stores partitioned JSON records for large dataset historical inspection.
CREATE TABLE IF NOT EXISTS public.dataset_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    record JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Crucial index for high-speed paginated retrieval by dataset_id
CREATE INDEX IF NOT EXISTS dataset_records_dataset_id_idx ON public.dataset_records(dataset_id);
CREATE INDEX IF NOT EXISTS dataset_records_row_number_idx ON public.dataset_records(dataset_id, row_number);

-- 5. TABLE: anomaly_logs
-- Stores detailed controlled edge-case mutations and mathematical justifications.
CREATE TABLE IF NOT EXISTS public.anomaly_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    row_number INTEGER,
    anomaly_type TEXT,
    target_column TEXT,
    original_value JSONB,
    mutated_value JSONB,
    severity TEXT,
    formula TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anomaly_logs_dataset_id_idx ON public.anomaly_logs(dataset_id);

-- ==============================================================================
-- 6. STORAGE BUCKETS CONFIGURATION
-- ==============================================================================
-- Configures the 'datasets' and 'reports' storage buckets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('datasets', 'datasets', false, 52428800, ARRAY['text/csv', 'application/json', 'text/plain']),
    ('reports', 'reports', false, 10485760, ARRAY['text/markdown', 'text/plain', 'application/json'])
ON CONFLICT (id) DO UPDATE SET
    public = false;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Security architecture note:
-- SyntheticLab is currently a single-workspace local engineering workbench.
-- Tables have RLS enabled. For hackathon/anon client access with the publishable
-- key, full access is granted for this workspace. To upgrade to multi-tenant
-- authentication, add a `user_id UUID DEFAULT auth.uid()` column and restrict 
-- with `USING (auth.uid() = user_id)`.

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_logs ENABLE ROW LEVEL SECURITY;

-- generation_jobs policies
DROP POLICY IF EXISTS "Allow anon read/write generation_jobs" ON public.generation_jobs;
CREATE POLICY "Allow anon read/write generation_jobs" ON public.generation_jobs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- datasets policies
DROP POLICY IF EXISTS "Allow anon read/write datasets" ON public.datasets;
CREATE POLICY "Allow anon read/write datasets" ON public.datasets
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- dataset_records policies
DROP POLICY IF EXISTS "Allow anon read/write dataset_records" ON public.dataset_records;
CREATE POLICY "Allow anon read/write dataset_records" ON public.dataset_records
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- anomaly_logs policies
DROP POLICY IF EXISTS "Allow anon read/write anomaly_logs" ON public.anomaly_logs;
CREATE POLICY "Allow anon read/write anomaly_logs" ON public.anomaly_logs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Storage bucket access policies (for anon and authenticated users)
DROP POLICY IF EXISTS "Allow anon upload datasets" ON storage.objects;
CREATE POLICY "Allow anon upload datasets" ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id IN ('datasets', 'reports'))
    WITH CHECK (bucket_id IN ('datasets', 'reports'));
