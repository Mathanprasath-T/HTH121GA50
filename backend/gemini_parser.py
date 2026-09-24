import os
import re
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Tuple, Optional

# Load .env file from project root or parent if present
def load_env_file():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(current_dir, '..', '.env'),
        os.path.join(current_dir, '.env')
    ]
    for env_path in candidates:
        if os.path.isfile(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

load_env_file()

# Canonical domain schemas strictly aligned with generatorEngine.ts
DOMAIN_SCHEMAS = {
    'ecommerce': [
        {'name': 'transaction_id', 'type': 'uuid', 'nullable': False, 'isIdentifier': True, 'description': 'Unique transaction identifier'},
        {'name': 'customer_id', 'type': 'uuid', 'nullable': False, 'description': 'Customer account reference'},
        {'name': 'timestamp', 'type': 'timestamp', 'nullable': False, 'description': 'ISO 8601 transaction timestamp'},
        {'name': 'amount', 'type': 'decimal', 'nullable': False, 'min': 2.50, 'max': 2500.00, 'precision': 2, 'description': 'Gross transaction amount in USD'},
        {'name': 'payment_method', 'type': 'categorical', 'nullable': False, 'enumOptions': ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'wire_transfer'], 'description': 'Payment processing gateway'},
        {'name': 'product_category', 'type': 'categorical', 'nullable': False, 'enumOptions': ['electronics', 'apparel', 'home_goods', 'digital_software', 'luxury_jewelry'], 'description': 'Primary inventory category'},
        {'name': 'device_type', 'type': 'categorical', 'nullable': False, 'enumOptions': ['desktop_chrome', 'desktop_safari', 'mobile_ios', 'mobile_android'], 'description': 'Client browser or device'},
        {'name': 'billing_country', 'type': 'categorical', 'nullable': False, 'enumOptions': ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'], 'description': 'Cardholder billing territory'},
        {'name': 'customer_email', 'type': 'varchar', 'nullable': True, 'description': 'Customer contact email address'},
        {'name': 'is_fraud', 'type': 'boolean', 'nullable': False, 'description': 'Binary fraud classifier ground truth'}
    ],
    'fintech': [
        {'name': 'transfer_id', 'type': 'uuid', 'nullable': False, 'isIdentifier': True, 'description': 'Settlement transaction reference'},
        {'name': 'originating_account', 'type': 'varchar', 'nullable': False, 'description': 'Sender account number'},
        {'name': 'beneficiary_account', 'type': 'varchar', 'nullable': False, 'description': 'Recipient account number'},
        {'name': 'timestamp', 'type': 'timestamp', 'nullable': False, 'description': 'Settlement timestamp'},
        {'name': 'amount', 'type': 'decimal', 'nullable': False, 'min': 50.00, 'max': 125000.00, 'precision': 2, 'description': 'Wire transfer value'},
        {'name': 'currency', 'type': 'categorical', 'nullable': False, 'enumOptions': ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'SGD'], 'description': 'ISO currency code'},
        {'name': 'transfer_rail', 'type': 'categorical', 'nullable': False, 'enumOptions': ['fedwire', 'swift_gpi', 'sepa_instant', 'chips'], 'description': 'Clearing mechanism'},
        {'name': 'swift_bic', 'type': 'varchar', 'nullable': True, 'description': 'Beneficiary bank identifier code'},
        {'name': 'origin_country', 'type': 'categorical', 'nullable': False, 'enumOptions': ['US', 'GB', 'DE', 'CH', 'SG', 'HK'], 'description': 'Originating banking jurisdiction'},
        {'name': 'is_aml_flagged', 'type': 'boolean', 'nullable': False, 'description': 'Anti-Money Laundering tripwire flag'}
    ],
    'iot': [
        {'name': 'reading_id', 'type': 'uuid', 'nullable': False, 'isIdentifier': True, 'description': 'Unique telemetry sample UUID'},
        {'name': 'device_id', 'type': 'varchar', 'nullable': False, 'description': 'Sensor asset tag identifier'},
        {'name': 'timestamp', 'type': 'timestamp', 'nullable': False, 'description': 'UTC timestamp of sample'},
        {'name': 'temperature_c', 'type': 'decimal', 'nullable': False, 'min': 18.0, 'max': 95.0, 'precision': 2, 'description': 'Chassis temperature in Celsius'},
        {'name': 'vibration_hz', 'type': 'decimal', 'nullable': False, 'min': 12.0, 'max': 240.0, 'precision': 2, 'description': 'Harmonic vibration frequency'},
        {'name': 'pressure_bar', 'type': 'decimal', 'nullable': False, 'min': 1.0, 'max': 8.5, 'precision': 2, 'description': 'Cooling line hydraulic pressure'},
        {'name': 'battery_level_pct', 'type': 'integer', 'nullable': True, 'min': 5, 'max': 100, 'description': 'Internal cell charge status'},
        {'name': 'firmware_version', 'type': 'categorical', 'nullable': False, 'enumOptions': ['v2.1.0', 'v2.2.4', 'v2.3.0-rc1'], 'description': 'Embedded firmware build'},
        {'name': 'is_anomaly', 'type': 'boolean', 'nullable': False, 'description': 'Sensor mechanical deviation status'}
    ],
    'saas_churn': [
        {'name': 'event_id', 'type': 'uuid', 'nullable': False, 'isIdentifier': True, 'description': 'Lifecycle event UUID'},
        {'name': 'account_id', 'type': 'uuid', 'nullable': False, 'description': 'Customer workspace reference'},
        {'name': 'timestamp', 'type': 'timestamp', 'nullable': False, 'description': 'Observation snapshot timestamp'},
        {'name': 'plan_tier', 'type': 'categorical', 'nullable': False, 'enumOptions': ['starter', 'growth', 'enterprise_scale', 'custom'], 'description': 'Active subscription tier'},
        {'name': 'mrr_amount', 'type': 'decimal', 'nullable': False, 'min': 49.00, 'max': 4800.00, 'precision': 2, 'description': 'Monthly recurring revenue USD'},
        {'name': 'tenure_months', 'type': 'integer', 'nullable': True, 'min': 1, max: 48, 'description': 'Account tenure length'},
        {'name': 'weekly_active_users', 'type': 'integer', 'nullable': False, 'min': 1, 'max': 85, 'description': 'Active seats in trailing 7 days'},
        {'name': 'support_tickets_30d', 'type': 'integer', 'nullable': False, 'min': 0, 'max': 14, 'description': 'Support escalation count'},
        {'name': 'is_churned', 'type': 'boolean', 'nullable': False, 'description': 'Subscription termination outcome'}
    ],
    'healthcare': [
        {'name': 'record_id', 'type': 'uuid', 'nullable': False, 'isIdentifier': True},
        {'name': 'patient_id', 'type': 'uuid', 'nullable': False},
        {'name': 'timestamp', 'type': 'timestamp', 'nullable': False},
        {'name': 'heart_rate_bpm', 'type': 'integer', 'nullable': False, 'min': 45, 'max': 180},
        {'name': 'systolic_bp', 'type': 'integer', 'nullable': False, 'min': 80, 'max': 200},
        {'name': 'diastolic_bp', 'type': 'integer', 'nullable': False, 'min': 50, 'max': 120},
        {'name': 'blood_glucose_mg_dl', 'type': 'decimal', 'nullable': True, 'min': 60, 'max': 400},
        {'name': 'is_flagged', 'type': 'boolean', 'nullable': False}
    ]
}

SYSTEM_INSTRUCTION = """You are the natural-language requirement parser for SyntheticLab.
Your job is to convert a user's synthetic dataset requirement into a structured JSON dataset specification.

Do not generate dataset rows.
Do not generate CSV.
Do not invent unsupported fields.
Do not execute code.
Do not return explanations or markdown wrappers. Return ONLY valid JSON matching this schema:
{
  "domain": "ecommerce" | "fintech" | "iot" | "saas_churn" | "healthcare",
  "totalRows": integer between 100 and 50000 (default 10000),
  "name": string (descriptive snake_case name, e.g. "ecommerce_transactions_10k"),
  "edgeCases": {
    "fraudRate": number (e.g. 2.0 for 2% fraud, NEVER as a fraction 0.02),
    "weekendSalesIncrease": number (e.g. 30.0 for 30% weekend uplift, NEVER as 0.30),
    "extremeValuesRate": number (e.g. 1.0 for 1% outliers, NEVER as 0.01),
    "missingValuesRate": number (e.g. 2.0 for 2% missing values/nulls, NEVER as 0.02),
    "duplicateRate": number (e.g. 0.2 for 0.2% duplicate keys),
    "invalidDatesRate": number (e.g. 0.1 for 0.1% corrupt dates),
    "rareCategoriesRate": number (e.g. 0.5 for 0.5% rare categories)
  }
}

CRITICAL RULES:
1. All percentage values MUST be whole or decimal numbers between 0 and 100 representing percentages (e.g. 2% is 2.0, 30% is 30.0, 1.5% is 1.5). NEVER output decimal fractions like 0.02 or 0.30.
2. Only supported domains: "ecommerce", "fintech", "iot", "saas_churn", "healthcare". If the request is generic, default to "ecommerce".
3. If an anomaly or edge case is not mentioned in the prompt, set it to the default: fraudRate=2.0, weekendSalesIncrease=30.0, extremeValuesRate=1.0, missingValuesRate=2.0, duplicateRate=0.2, invalidDatesRate=0.1, rareCategoriesRate=0.5.
4. Output raw JSON only.
"""

def sanitize_percentage(val: Any, default: float, prompt_text: str = '', keywords: list = None) -> float:
    """Safely sanitizes and bounds percentage numbers between 0.0 and 100.0."""
    # 1. If explicitly mentioned with % in prompt, prefer the explicit prompt value
    if keywords and prompt_text:
        for kw in keywords:
            m = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(?:higher\s+|extreme-value\s+)?' + kw, prompt_text, re.IGNORECASE)
            if m:
                try:
                    return max(0.0, min(100.0, round(float(m.group(1)), 2)))
                except ValueError:
                    pass

    # 2. Use model value or default
    try:
        f = float(val)
        # Only scale if model provided a tiny fraction like 0.02 for an expected >= 1.0 default (like 2% or 30%)
        if 0.0 < f < 0.08 and default >= 1.0:
            f = f * 100.0
        return max(0.0, min(100.0, round(f, 2)))
    except (ValueError, TypeError):
        return default

def sanitize_total_rows(val: Any, default: int = 10000) -> int:
    try:
        r = int(val)
        return max(100, min(50000, r))
    except (ValueError, TypeError):
        return default

def sanitize_domain(val: Any, default: str = 'ecommerce') -> str:
    s = str(val or '').strip().lower()
    if s in DOMAIN_SCHEMAS:
        return s
    # Keyword fallback
    if any(k in s for k in ['bank', 'wire', 'aml', 'transfer', 'fintech']):
        return 'fintech'
    if any(k in s for k in ['sensor', 'iot', 'telemetry', 'vibration', 'temperature']):
        return 'iot'
    if any(k in s for k in ['churn', 'subscription', 'saas']):
        return 'saas_churn'
    if any(k in s for k in ['health', 'patient', 'clinical']):
        return 'healthcare'
    return default

def sanitize_name(val: Any, domain: str, rows: int) -> str:
    s = str(val or '').strip().lower()
    s = re.sub(r'[^a-z0-9_]', '_', s)
    s = re.sub(r'_+', '_', s).strip('_')
    if not s or len(s) < 3:
        row_label = f"{round(rows / 1000)}k" if rows >= 1000 else str(rows)
        return f"{domain}_dataset_{row_label}"
    return s[:64]

def call_gemini_api(prompt: str, seed: int = 582941) -> Tuple[bool, Optional[Dict[str, Any]], str, str]:
    """
    Calls the Google Gemini API to parse natural language into structured DatasetSpecification.
    Returns: (success: bool, specification: dict or None, model_name: str, error_message: str)
    """
    load_env_file()
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        return False, None, '', "GEMINI_API_KEY environment variable is not configured on the backend server."

    preferred_model = os.environ.get('GEMINI_MODEL', 'models/gemini-3.5-flash').strip()
    candidate_models = [
        preferred_model,
        'models/gemini-3.5-flash',
        'models/gemini-3.5-flash-lite',
        'models/gemini-3.7-flash',
        'models/gemini-flash-latest'
    ]
    # Deduplicate while preserving order
    seen = set()
    model_queue = [m for m in candidate_models if not (m in seen or seen.add(m))]

    # Limit prompt length to protect against abuse
    safe_prompt = prompt[:2000].strip()
    if not safe_prompt:
        return False, None, '', "Prompt cannot be empty."

    payload = {
        'system_instruction': {
            'parts': [{'text': SYSTEM_INSTRUCTION}]
        },
        'contents': [
            {'parts': [{'text': safe_prompt}]}
        ],
        'generationConfig': {
            'response_mime_type': 'application/json',
            'temperature': 0.1
        }
    }
    payload_bytes = json.dumps(payload).encode('utf-8')

    last_error = ""
    for model_name in model_queue:
        # Strip duplicate "models/" if present when constructing URL
        clean_model = model_name if model_name.startswith('models/') else f"models/{model_name}"
        url = f"https://generativelanguage.googleapis.com/v1beta/{clean_model}:generateContent?key={api_key}"

        req = urllib.request.Request(
            url,
            data=payload_bytes,
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    resp_data = json.loads(response.read().decode('utf-8'))
                    candidates = resp_data.get('candidates', [])
                    if not candidates:
                        last_error = "Gemini returned no candidates."
                        continue

                    parts = candidates[0].get('content', {}).get('parts', [])
                    if not parts or 'text' not in parts[0]:
                        last_error = "Gemini returned empty content."
                        continue

                    raw_text = parts[0]['text'].strip()
                    # Strip markdown block ticks if model added them despite response_mime_type
                    if raw_text.startswith('```'):
                        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                        raw_text = re.sub(r'\s*```$', '', raw_text)

                    parsed_json = json.loads(raw_text)

                    # Validate & Sanitize Model Output
                    domain = sanitize_domain(parsed_json.get('domain'), 'ecommerce')
                    total_rows = sanitize_total_rows(parsed_json.get('totalRows'), 10000)
                    name = sanitize_name(parsed_json.get('name'), domain, total_rows)

                    raw_edges = parsed_json.get('edgeCases', {})
                    edge_cases = {
                        'fraudRate': sanitize_percentage(raw_edges.get('fraudRate'), 2.0, safe_prompt, ['fraud', 'aml', 'anomaly', 'churn']),
                        'weekendSalesIncrease': sanitize_percentage(raw_edges.get('weekendSalesIncrease'), 30.0, safe_prompt, ['weekend', 'higher weekend']),
                        'extremeValuesRate': sanitize_percentage(raw_edges.get('extremeValuesRate'), 1.0, safe_prompt, ['extreme', 'outlier', 'spikes']),
                        'missingValuesRate': sanitize_percentage(raw_edges.get('missingValuesRate'), 2.0, safe_prompt, ['missing', 'null', 'dropout']),
                        'duplicateRate': sanitize_percentage(raw_edges.get('duplicateRate'), 0.2, safe_prompt, ['duplicate', 'dups']),
                        'invalidDatesRate': sanitize_percentage(raw_edges.get('invalidDatesRate'), 0.1, safe_prompt, ['invalid date', 'corrupt']),
                        'rareCategoriesRate': sanitize_percentage(raw_edges.get('rareCategoriesRate'), 0.5, safe_prompt, ['rare', 'uncommon'])
                    }

                    schema = DOMAIN_SCHEMAS.get(domain, DOMAIN_SCHEMAS['ecommerce'])
                    timestamp_iso = '2026-09-25T02:00:00.000Z'
                    import datetime
                    try:
                        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    except Exception:
                        pass

                    spec_id = f"spec_gemini_{int(datetime.datetime.now().timestamp())}_{seed % 10000}"

                    specification = {
                        'id': spec_id,
                        'name': name,
                        'domain': domain,
                        'prompt': safe_prompt,
                        'totalRows': total_rows,
                        'seed': int(seed),
                        'createdAt': timestamp_iso,
                        'schema': schema,
                        'edgeCases': edge_cases
                    }

                    return True, specification, clean_model, ""

        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode('utf-8')
            except Exception:
                pass
            last_error = f"Gemini API HTTP {e.code}: {err_body[:200]}"
            # If 404 or 503, try next candidate model in queue
            continue
        except urllib.error.URLError as e:
            last_error = f"Network connection failed: {e.reason}"
            continue
        except json.JSONDecodeError as e:
            last_error = f"Malformed JSON from Gemini model: {str(e)}"
            continue
        except Exception as e:
            last_error = f"Unexpected Gemini integration error: {str(e)}"
            continue

    return False, None, '', last_error or "All candidate Gemini models failed to respond."


def generate_gemini_synthetic_rows(
    prompt: str,
    schema: list,
    count: int = 25,
    edge_cases: dict = None
) -> Tuple[bool, list, str, str]:
    """
    Directly prompts Google Gemini API to generate synthetic data rows conforming
    to the given schema and constraints using GEMINI_API_KEY.
    Returns: (success: bool, records: list, model_name: str, error_message: str)
    """
    load_env_file()
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        return False, [], '', "GEMINI_API_KEY environment variable is not configured."

    preferred_model = os.environ.get('GEMINI_MODEL', 'models/gemini-3.5-flash-lite').strip()
    candidate_models = [
        preferred_model,
        'models/gemini-3.5-flash-lite',
        'models/gemini-3.5-flash',
        'models/gemini-2.5-flash',
        'models/gemini-flash-latest'
    ]
    seen = set()
    model_queue = [m for m in candidate_models if not (m in seen or seen.add(m))]

    row_count = max(1, min(int(count), 50))
    columns_summary = [f"{col.get('name')} ({col.get('type')})" for col in schema]

    system_inst = (
        "You are the synthetic data row generator for SyntheticLab. "
        "Generate realistic, high-fidelity synthetic JSON records strictly matching the user requirements and schema. "
        "Return ONLY a valid JSON array of objects without markdown formatting or commentary. "
        "Each object must have the exact column names specified in the schema. "
        "Ensure realistic diversity, accurate data types, and respect edge cases (such as fraud flags, outliers, or missing values) if requested."
    )

    user_req = f"""Generate exactly {row_count} synthetic dataset records for this scenario:
Prompt: {prompt}

Columns:
{json.dumps(columns_summary, indent=2)}

Edge cases / anomaly constraints:
{json.dumps(edge_cases or {}, indent=2)}

Output ONLY a JSON array containing {row_count} records. Example format:
[
  {{"col1": "val1", "col2": 123.45}}
]"""

    payload = {
        'system_instruction': {
            'parts': [{'text': system_inst}]
        },
        'contents': [
            {'parts': [{'text': user_req}]}
        ],
        'generationConfig': {
            'response_mime_type': 'application/json',
            'temperature': 0.7
        }
    }
    payload_bytes = json.dumps(payload).encode('utf-8')

    last_error = ""
    for model_name in model_queue:
        clean_model = model_name if model_name.startswith('models/') else f"models/{model_name}"
        url = f"https://generativelanguage.googleapis.com/v1beta/{clean_model}:generateContent?key={api_key}"

        req = urllib.request.Request(
            url,
            data=payload_bytes,
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                if response.status == 200:
                    resp_data = json.loads(response.read().decode('utf-8'))
                    candidates = resp_data.get('candidates', [])
                    if not candidates:
                        continue
                    parts = candidates[0].get('content', {}).get('parts', [])
                    if not parts or 'text' not in parts[0]:
                        continue
                    raw_text = parts[0]['text'].strip()
                    if raw_text.startswith('```'):
                        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                        raw_text = re.sub(r'\s*```$', '', raw_text)

                    records = json.loads(raw_text)
                    if isinstance(records, dict):
                        records = records.get('records') or records.get('data') or [records]
                    if not isinstance(records, list):
                        records = [records]

                    clean_records = []
                    for idx, rec in enumerate(records):
                        if isinstance(rec, dict):
                            rec['_rowId'] = idx + 1
                            rec['_hasAnomaly'] = bool(rec.get('is_fraud') or rec.get('is_aml_flagged') or rec.get('is_anomaly') or rec.get('is_churned'))
                            rec['_anomalyTypes'] = ['FRAUD_INJECTION'] if rec['_hasAnomaly'] else []
                            clean_records.append(rec)

                    return True, clean_records, clean_model, ""

        except Exception as e:
            last_error = str(e)
            continue

    return False, [], '', last_error or "Gemini failed to generate dataset records."
