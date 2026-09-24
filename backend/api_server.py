import http.server
import socketserver
import json
import os
import sys
import re
import urllib.parse
from io import BytesIO

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from validation_engine import (
    load_dataframe,
    extract_preview,
    run_full_validation_comparison
)

from sample_benchmark import generate_sample_benchmark_pair
from gemini_parser import call_gemini_api, generate_gemini_synthetic_rows, load_env_file

load_env_file()

PORT = int(os.environ.get('PORT', 8000))
comparison_cache = {}

class ValidationLabHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            api_key_configured = bool(os.environ.get('GEMINI_API_KEY'))
            configured_model = os.environ.get('GEMINI_MODEL', 'models/gemini-3.5-flash')
            self.wfile.write(json.dumps({
                "status": "ok",
                "engine": "Python NumPy + Pandas Statistical Engine v2.4.0",
                "cached_comparisons": len(comparison_cache),
                "ai_parser": {
                    "enabled": api_key_configured,
                    "model": configured_model if api_key_configured else "not_configured"
                }
            }).encode('utf-8'))
            return

        if path == '/api/validation/sample-data':
            syn_df, ref_df = generate_sample_benchmark_pair(2500)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "synthetic_filename": "synthetic_ecommerce_sample.csv",
                "synthetic_csv": syn_df.to_csv(index=False),
                "reference_filename": "reference_retail_kaggle_sample.csv",
                "reference_csv": ref_df.to_csv(index=False)
            }).encode('utf-8'))
            return

        # Matches /api/validation/{id}
        m_id = re.match(r'^/api/validation/([^/]+)$', path)
        if m_id:
            cmp_id = m_id.group(1)
            if cmp_id in comparison_cache:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(comparison_cache[cmp_id]).encode('utf-8'))
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Comparison not found"}).encode('utf-8'))
            return

        # Matches /api/validation/{id}/summary
        m_sum = re.match(r'^/api/validation/([^/]+)/summary$', path)
        if m_sum:
            cmp_id = m_sum.group(1)
            if cmp_id in comparison_cache:
                data = comparison_cache[cmp_id]
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "id": cmp_id,
                    "executive_summary": data["executive_summary"],
                    "similarity_index": data["similarity_index"]
                }).encode('utf-8'))
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
            return

        # Matches /api/validation/{id}/report
        m_rep = re.match(r'^/api/validation/([^/]+)/report$', path)
        if m_rep:
            cmp_id = m_rep.group(1)
            if cmp_id in comparison_cache:
                data = comparison_cache[cmp_id]
                report_md = self._generate_markdown_report(data)
                self.send_response(200)
                self.send_header('Content-Type', 'text/markdown; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename=validation_report_{cmp_id}.md')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(report_md.encode('utf-8'))
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
            return

        # Matches /api/validation/{id}/download (CSV export)
        m_dl = re.match(r'^/api/validation/([^/]+)/download$', path)
        if m_dl:
            cmp_id = m_dl.group(1)
            if cmp_id in comparison_cache:
                data = comparison_cache[cmp_id]
                csv_out = self._generate_comparison_csv(data)
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename=comparison_deltas_{cmp_id}.csv')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(csv_out.encode('utf-8'))
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        if path == '/api/ai/parse':
            try:
                data = json.loads(post_data.decode('utf-8'))
                prompt = data.get('prompt', '').strip()
                seed = int(data.get('seed', 582941))

                if not prompt:
                    raise ValueError("Requirement prompt cannot be empty.")

                success, spec, model_used, err_msg = call_gemini_api(prompt, seed)
                if success and spec:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": True,
                        "source": "gemini",
                        "model": model_used,
                        "specification": spec
                    }).encode('utf-8'))
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": False,
                        "source": "gemini",
                        "error": err_msg or "Gemini requirement parsing could not be completed."
                    }).encode('utf-8'))
            except Exception as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "source": "gemini",
                    "error": str(e)
                }).encode('utf-8'))
            return

        if path == '/api/ai/generate_rows':
            try:
                data = json.loads(post_data.decode('utf-8'))
                prompt = data.get('prompt', '')
                schema = data.get('schema', [])
                count = int(data.get('count', 25))
                edge_cases = data.get('edgeCases', {})

                success, records, model_used, err_msg = generate_gemini_synthetic_rows(
                    prompt, schema, count, edge_cases
                )
                if success:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": True,
                        "source": "gemini",
                        "model": model_used,
                        "records": records,
                        "count": len(records)
                    }).encode('utf-8'))
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": False,
                        "error": err_msg or "Failed to generate records with Gemini"
                    }).encode('utf-8'))
            except Exception as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": str(e)
                }).encode('utf-8'))
            return

        if path == '/api/validation/upload':
            try:
                # Can accept JSON with filename & content or raw binary
                data = json.loads(post_data.decode('utf-8'))
                file_text = data.get('content', '')
                filename = data.get('filename', 'dataset.csv')
                file_bytes = file_text.encode('utf-8')
                df = load_dataframe(file_bytes, filename)
                preview = extract_preview(df, filename, len(file_bytes))
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "preview": preview}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        if path == '/api/validation/compare':
            try:
                # Accept JSON payload: { synthetic_csv, synthetic_filename, reference_csv, reference_filename }
                data = json.loads(post_data.decode('utf-8'))
                
                synth_csv = data.get('synthetic_csv', '')
                synth_name = data.get('synthetic_filename', 'synthetic.csv')
                ref_csv = data.get('reference_csv', '')
                ref_name = data.get('reference_filename', 'reference.csv')

                if not synth_csv or not ref_csv:
                    raise ValueError("Both synthetic_csv and reference_csv payloads must be provided.")

                synth_bytes = synth_csv.encode('utf-8')
                ref_bytes = ref_csv.encode('utf-8')

                result = run_full_validation_comparison(
                    synth_bytes=synth_bytes,
                    synth_filename=synth_name,
                    ref_bytes=ref_bytes,
                    ref_filename=ref_name
                )

                comparison_cache[result["id"]] = result

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(422)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def _generate_markdown_report(self, data: dict) -> str:
        s_prev = data["previews"]["synthetic"]
        r_prev = data["previews"]["reference"]
        schema = data["schema_analysis"]
        sim = data["similarity_index"]
        sum_data = data["executive_summary"]

        lines = [
            "# SyntheticLab Validation Audit: Synthetic vs Reference Comparison",
            f"**Audit ID**: `{data['id']}`",
            f"**Generated**: {data['timestamp']}",
            f"**Notice**: {data['disclaimer']}",
            "",
            "---",
            "",
            "## 1. Executive Summary",
            f"- **Statistical Similarity Index**: **{sim['index_value']} / 100**",
            f"- **Schema Compatibility**: `{schema['schema_compatibility']}` ({schema['common_columns_count']} common columns)",
            f"- **Numeric Distributions**: {sum_data['numeric_summary']}",
            f"- **Categorical Proportions**: {sum_data['categorical_summary']}",
            f"- **Missingness Alignment**: {sum_data['missingness_summary']}",
            f"- **Correlation Preservation**: {sum_data['correlation_summary']}",
            "",
            "### Key Findings:"
        ]
        for f in sum_data["key_findings"]:
            lines.append(f"- {f}")

        lines.extend([
            "",
            "---",
            "",
            "## 2. Dataset Overview",
            "| Metric | Synthetic Dataset | Reference Dataset |",
            "|:---|:---:|:---:|",
            f"| **File Name** | `{s_prev['filename']}` | `{r_prev['filename']}` |",
            f"| **Row Count** | {s_prev['row_count']:,} | {r_prev['row_count']:,} |",
            f"| **Column Count** | {s_prev['column_count']} | {r_prev['column_count']} |",
            f"| **Missing Cells** | {s_prev['total_missing_cells']:,} ({s_prev['missing_rate_pct']}%) | {r_prev['total_missing_cells']:,} ({r_prev['missing_rate_pct']}%) |",
            "",
            "---",
            "",
            "## 3. Numeric Distribution Comparison",
            "| Column | Synthetic Mean (Std) | Reference Mean (Std) | KS Statistic | Wasserstein Dist | Status |",
            "|:---|:---:|:---:|:---:|:---:|:---:|"
        ])

        for num in data["numeric_comparison"]:
            s_m = f"{num['synthetic']['mean']} (±{num['synthetic']['std']})"
            r_m = f"{num['reference']['mean']} (±{num['reference']['std']})"
            ks_stat = f"D={num['statistical_tests']['ks_statistic']}"
            w_dist = num['statistical_tests']['wasserstein_distance']
            status = "CLOSE" if num['statistical_tests']['ks_passed_similarity'] else "DRIFTED"
            lines.append(f"| **{num['column']}** | {s_m} | {r_m} | {ks_stat} | {w_dist} | `{status}` |")

        lines.extend([
            "",
            "---",
            "",
            "## 4. Potential Data Issues",
            ""
        ])

        for issue in data["potential_issues"]:
            lines.append(f"- **[{issue['severity'].upper()}] {issue['category']} - {issue['type']}** (`{issue['column']}`)")
            lines.append(f"  - *Evidence*: {issue['evidence']}")
            lines.append(f"  - *Interpretation*: {issue['interpretation']}")

        lines.extend([
            "",
            "---",
            "",
            "## 5. Downstream ML & Testing Recommendations",
            "### Suitable For:"
        ])
        for s in data["recommendations"]["suitable_for"]:
            lines.append(f"- ✓ {s}")

        lines.append("")
        lines.append("### Use with Caution For:")
        for c in data["recommendations"]["use_with_caution"]:
            lines.append(f"- ⚠ {c}")

        lines.append("")
        lines.append("---")
        lines.append("*Generated by SyntheticLab Statistical Validation Lab.*")

        return "\n".join(lines)

    def _generate_comparison_csv(self, data: dict) -> str:
        headers = [
            "column", "synthetic_mean", "reference_mean", "mean_difference", "mean_rel_diff_pct",
            "synthetic_std", "reference_std", "synthetic_median", "reference_median",
            "ks_statistic", "ks_pvalue", "wasserstein_distance", "synthetic_missing_pct", "reference_missing_pct"
        ]
        rows = [",".join(headers)]
        for num in data["numeric_comparison"]:
            row = [
                f'"{num["column"]}"',
                str(num["synthetic"]["mean"]),
                str(num["reference"]["mean"]),
                str(num["deltas"]["mean_diff"]),
                str(num["deltas"]["mean_rel_diff_pct"]),
                str(num["synthetic"]["std"]),
                str(num["reference"]["std"]),
                str(num["synthetic"]["median"]),
                str(num["reference"]["median"]),
                str(num["statistical_tests"]["ks_statistic"]),
                str(num["statistical_tests"]["ks_pvalue"]),
                str(num["statistical_tests"]["wasserstein_distance"]),
                str(num["synthetic"]["missing_pct"]),
                str(num["reference"]["missing_pct"])
            ]
            rows.append(",".join(row))
        return "\n".join(rows)

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 8000))
    try:
        httpd = socketserver.TCPServer((host, port), ValidationLabHandler)
    except OSError:
        port = 8080
        httpd = socketserver.TCPServer((host, port), ValidationLabHandler)
        
    print(f"SyntheticLab Validation Lab API server running at http://{host}:{port}", flush=True)
    httpd.serve_forever()
