from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
import json
import io
import os
import sys
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any

# Ensure local module directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

try:
    from validation_engine import (
        load_dataframe,
        extract_preview,
        run_full_validation_comparison
    )
except ImportError:
    from backend.validation_engine import (
        load_dataframe,
        extract_preview,
        run_full_validation_comparison
    )

app = FastAPI(
    title="SyntheticLab - Synthetic vs Reference Validation Lab API",
    version="2.4.0",
    description="Factual statistical comparison and validation engine for synthetic vs reference datasets."
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory comparison cache
comparison_cache: Dict[str, Dict[str, Any]] = {}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "engine": "FastAPI + SciPy Statistical Engine v2.4.0"}

@app.post("/api/validation/upload")
async def upload_dataset_preview(file: UploadFile = File(...)):
    """Uploads a dataset and returns immediate structural preview without storing raw data."""
    try:
        contents = await file.read()
        df = load_dataframe(contents, file.filename)
        preview = extract_preview(df, file.filename, len(contents))
        return JSONResponse(content={"status": "success", "preview": preview})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse dataset file: {str(e)}")

@app.post("/api/validation/compare")
async def compare_datasets(
    synthetic_file: UploadFile = File(...),
    reference_file: UploadFile = File(...)
):
    """Executes full mathematical and statistical comparison across uploaded Synthetic and Reference datasets."""
    try:
        synth_bytes = await synthetic_file.read()
        ref_bytes = await reference_file.read()
        
        result = run_full_validation_comparison(
            synth_bytes=synth_bytes,
            synth_filename=synthetic_file.filename,
            ref_bytes=ref_bytes,
            ref_filename=reference_file.filename
        )
        
        # Store in cache
        comparison_cache[result["id"]] = result
        return JSONResponse(content=result)
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Statistical analysis failed: {str(e)}")

@app.get("/api/validation/{comparison_id}")
async def get_comparison(comparison_id: str):
    """Retrieves full comparison report by ID."""
    if comparison_id not in comparison_cache:
        raise HTTPException(status_code=404, detail="Comparison record not found")
    return JSONResponse(content=comparison_cache[comparison_id])

@app.get("/api/validation/{comparison_id}/summary")
async def get_comparison_summary(comparison_id: str):
    """Retrieves concise executive summary for a comparison ID."""
    if comparison_id not in comparison_cache:
        raise HTTPException(status_code=404, detail="Comparison record not found")
    cmp_data = comparison_cache[comparison_id]
    return JSONResponse(content={
        "id": comparison_id,
        "executive_summary": cmp_data["executive_summary"],
        "similarity_index": cmp_data["similarity_index"]
    })

@app.get("/api/validation/{comparison_id}/report")
async def get_comparison_report_markdown(comparison_id: str):
    """Generates formatted technical Markdown audit report."""
    if comparison_id not in comparison_cache:
        raise HTTPException(status_code=404, detail="Comparison record not found")
        
    data = comparison_cache[comparison_id]
    synth_prev = data["previews"]["synthetic"]
    ref_prev = data["previews"]["reference"]
    schema = data["schema_analysis"]
    sim = data["similarity_index"]
    summary = data["executive_summary"]
    
    lines = [
        f"# SyntheticLab Validation Audit: Synthetic vs Reference Comparison",
        f"",
        f"**Audit ID**: `{comparison_id}`",
        f"**Evaluated At**: {data['timestamp']}",
        f"**Notice**: {data['disclaimer']}",
        f"",
        f"---",
        f"",
        f"## 1. Executive Summary",
        f"",
        f"- **Statistical Similarity Index**: **{sim['index_value']} / 100**",
        f"- **Schema Compatibility**: `{schema['schema_compatibility']}` ({schema['common_columns_count']} common columns)",
        f"- **Numeric Distributions**: {summary['numeric_summary']}",
        f"- **Categorical Proportions**: {summary['categorical_summary']}",
        f"- **Missingness**: {summary['missingness_summary']}",
        f"- **Correlations**: {summary['correlation_summary']}",
        f"",
        f"### Key Findings:",
    ]
    
    for f in summary["key_findings"]:
        lines.append(f"- {f}")
        
    lines.extend([
        f"",
        f"---",
        f"",
        f"## 2. Dataset Overview",
        f"",
        f"| Metric | Synthetic Dataset | Reference Dataset |",
        f"|:---|:---:|:---:|",
        f"| **File Name** | `{synth_prev['filename']}` | `{ref_prev['filename']}` |",
        f"| **Row Count** | {synth_prev['row_count']:,} | {ref_prev['row_count']:,} |",
        f"| **Column Count** | {synth_prev['column_count']} | {ref_prev['column_count']} |",
        f"| **Missing Cells** | {synth_prev['total_missing_cells']:,} ({synth_prev['missing_rate_pct']}%) | {ref_prev['total_missing_cells']:,} ({ref_prev['missing_rate_pct']}%) |",
        f"",
        f"---",
        f"",
        f"## 3. Numeric Distribution Comparison",
        f"",
        f"| Column | Synthetic Mean (Std) | Reference Mean (Std) | KS Statistic (p-value) | Wasserstein Dist | Status |",
        f"|:---|:---:|:---:|:---:|:---:|:---:|",
    ])
    
    for num in data["numeric_comparison"]:
        s_m = f"{num['synthetic']['mean']} (±{num['synthetic']['std']})"
        r_m = f"{num['reference']['mean']} (±{num['reference']['std']})"
        ks_str = f"D={num['statistical_tests']['ks_statistic']} (p={num['statistical_tests']['ks_pvalue']:.2e})"
        w_dist = num['statistical_tests']['wasserstein_distance']
        status = "CLOSE" if num['statistical_tests']['ks_passed_similarity'] else "DRIFTED"
        lines.append(f"| **{num['column']}** | {s_m} | {r_m} | {ks_str} | {w_dist} | `{status}` |")
        
    lines.extend([
        f"",
        f"---",
        f"",
        f"## 4. Potential Data Issues",
        f"",
    ])
    
    for issue in data["potential_issues"]:
        lines.append(f"- **[{issue['severity'].upper()}] {issue['category']} - {issue['type']}** (`{issue['column']}`)")
        lines.append(f"  - *Evidence*: {issue['evidence']}")
        lines.append(f"  - *Interpretation*: {issue['interpretation']}")
        
    lines.extend([
        f"",
        f"---",
        f"",
        f"## 5. Downstream ML & Testing Use-Case Suitability",
        f"",
        f"### Suitable for:",
    ])
    for s in data["recommendations"]["suitable_for"]:
        lines.append(f"- ✓ {s}")
        
    lines.append(f"")
    lines.append(f"### Use with caution for:")
    for c in data["recommendations"]["use_with_caution"]:
        lines.append(f"- ⚠ {c}")
        
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"*Generated by SyntheticLab Statistical Validation Lab.*")
    
    return PlainTextResponse(content="\n".join(lines), media_type="text/markdown")

@app.get("/api/validation/{comparison_id}/download")
async def download_comparison_csv(comparison_id: str):
    """Exports numeric and categorical comparison deltas as CSV."""
    if comparison_id not in comparison_cache:
        raise HTTPException(status_code=404, detail="Comparison record not found")
        
    data = comparison_cache[comparison_id]
    numeric_rows = []
    for num in data["numeric_comparison"]:
        numeric_rows.append({
            "type": "NUMERIC",
            "column": num["column"],
            "synthetic_mean": num["synthetic"]["mean"],
            "reference_mean": num["reference"]["mean"],
            "mean_difference": num["deltas"]["mean_diff"],
            "mean_rel_diff_pct": num["deltas"]["mean_rel_diff_pct"],
            "synthetic_std": num["synthetic"]["std"],
            "reference_std": num["reference"]["std"],
            "ks_statistic": num["statistical_tests"]["ks_statistic"],
            "ks_pvalue": num["statistical_tests"]["ks_pvalue"],
            "wasserstein_distance": num["statistical_tests"]["wasserstein_distance"],
            "synthetic_missing_pct": num["synthetic"]["missing_pct"],
            "reference_missing_pct": num["reference"]["missing_pct"]
        })
        
    df_export = pd.DataFrame(numeric_rows)
    csv_str = df_export.to_csv(index=False)
    
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=comparison_{comparison_id}.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
