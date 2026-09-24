import type { DatasetSpecification } from '../types';
import { parseNaturalLanguageRequirement } from './nlpParser';

const API_BASE = 'http://127.0.0.1:8000';

export interface AiParseResult {
  specification: DatasetSpecification;
  source: 'gemini' | 'fallback';
  model?: string;
  error?: string;
}

/**
 * Attempts to parse a natural language requirement using the Gemini GenAI backend.
 * Automatically and seamlessly falls back to the deterministic local nlpParser if
 * Gemini API is offline, errors, rate limits, or returns invalid data.
 */
export async function parseRequirementWithAi(
  prompt: string,
  seed: number = 582941
): Promise<AiParseResult> {
  // If prompt is empty, use local parser directly
  if (!prompt.trim()) {
    const spec = parseNaturalLanguageRequirement(prompt, seed);
    return { specification: spec, source: 'fallback' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}/api/ai/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        seed
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.specification) {
        return {
          specification: data.specification as DatasetSpecification,
          source: 'gemini',
          model: data.model || 'models/gemini-3.5-flash'
        };
      }
      // If backend returned success: false, fall back gracefully
      console.warn('[SyntheticLab AI Parser] Gemini parsing unsuccessful, using local fallback:', data.error);
      const fallbackSpec = parseNaturalLanguageRequirement(prompt, seed);
      return {
        specification: fallbackSpec,
        source: 'fallback',
        error: data.error || 'Gemini requirement parser unavailable'
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[SyntheticLab AI Parser] Backend connection error, falling back to local NLP parser:', err?.message);
  }

  // Guaranteed fallback to existing local deterministic parser
  const fallbackSpec = parseNaturalLanguageRequirement(prompt, seed);
  return {
    specification: fallbackSpec,
    source: 'fallback',
    error: 'Gemini service unreachable. Local deterministic parser utilized.'
  };
}

export interface AiGenerateRowsResult {
  success: boolean;
  records: any[];
  count: number;
  model?: string;
  error?: string;
}

/**
 * Directly generates synthetic dataset records using Google Gemini API.
 */
export async function generateRowsWithGeminiAi(
  prompt: string,
  schema: any[],
  count: number = 25,
  edgeCases?: any
): Promise<AiGenerateRowsResult> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/generate_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, schema, count, edgeCases })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        return {
          success: true,
          records: data.records,
          count: data.records.length,
          model: data.model
        };
      }
      return { success: false, records: [], count: 0, error: data.error };
    }
  } catch (err: any) {
    return { success: false, records: [], count: 0, error: err?.message };
  }
  return { success: false, records: [], count: 0, error: 'Gemini row generation failed' };
}

