import io
import math
import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple

def load_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Safely loads CSV or Excel into pandas DataFrame with encoding fallback."""
    lower = filename.lower()
    if lower.endswith(('.xlsx', '.xls')):
        return pd.read_excel(io.BytesIO(file_bytes))
    
    # Try utf-8, fallback to latin1 or iso-8859-1
    for enc in ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']:
        try:
            return pd.read_csv(io.BytesIO(file_bytes), encoding=enc)
        except UnicodeDecodeError:
            continue
        except Exception as e:
            raise ValueError(f"Could not parse CSV file with {enc} encoding: {str(e)}")
            
    raise ValueError("Could not decode file with supported text encodings (UTF-8, Latin1, CP1252).")

def infer_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """Infers semantic data type for each column in dataframe."""
    types = {}
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            types[col] = 'empty'
            continue
            
        # Check if numeric
        if pd.api.types.is_numeric_dtype(series):
            # Check if boolean represented as 0/1
            unique_vals = set(series.unique())
            if unique_vals.issubset({0, 1}) and len(unique_vals) <= 2:
                types[col] = 'boolean'
            else:
                types[col] = 'numeric'
            continue
            
        # Check if date/time
        if pd.api.types.is_datetime64_any_dtype(series):
            types[col] = 'datetime'
            continue
            
        # Try parsing strings as date
        sample = series.head(20).astype(str)
        is_date = False
        try:
            parsed = pd.to_datetime(sample, errors='coerce', format='mixed')
            if parsed.notna().sum() / len(sample) >= 0.8:
                is_date = True
        except Exception:
            pass
            
        if is_date:
            types[col] = 'datetime'
            continue
            
        # Check if ID-like (high unique ratio string, e.g. UUID, id, hash)
        unique_ratio = len(series.unique()) / len(series)
        col_lower = str(col).lower()
        if unique_ratio > 0.85 and ('id' in col_lower or 'uuid' in col_lower or 'key' in col_lower or 'hash' in col_lower or 'ref' in col_lower):
            types[col] = 'id'
            continue
            
        # Categorical
        types[col] = 'categorical'
        
    return types

def extract_preview(df: pd.DataFrame, filename: str, file_size: int) -> Dict[str, Any]:
    """Generates preview summary metrics for an uploaded dataset."""
    col_types = infer_column_types(df)
    
    numeric_cols = [c for c, t in col_types.items() if t == 'numeric']
    cat_cols = [c for c, t in col_types.items() if t == 'categorical']
    date_cols = [c for c, t in col_types.items() if t == 'datetime']
    id_cols = [c for c, t in col_types.items() if t == 'id']
    
    total_cells = df.shape[0] * df.shape[1]
    missing_cells = int(df.isna().sum().sum())
    missing_pct = round((missing_cells / max(1, total_cells)) * 100, 2)
    
    return {
        "filename": filename,
        "filesize_bytes": file_size,
        "row_count": int(df.shape[0]),
        "column_count": int(df.shape[1]),
        "numeric_column_count": len(numeric_cols),
        "categorical_column_count": len(cat_cols),
        "datetime_column_count": len(date_cols),
        "id_column_count": len(id_cols),
        "total_missing_cells": missing_cells,
        "missing_rate_pct": missing_pct,
        "columns": [str(c) for c in df.columns],
        "column_types": col_types,
        "head_sample": df.head(5).fillna("").to_dict(orient='records')
    }

def analyze_schemas(synth_df: pd.DataFrame, ref_df: pd.DataFrame) -> Dict[str, Any]:
    """Compares columns and detected types between synthetic and reference."""
    synth_cols = set(synth_df.columns)
    ref_cols = set(ref_df.columns)
    
    common = sorted(list(synth_cols.intersection(ref_cols)))
    synth_only = sorted(list(synth_cols - ref_cols))
    ref_only = sorted(list(ref_cols - synth_cols))
    
    synth_types = infer_column_types(synth_df)
    ref_types = infer_column_types(ref_df)
    
    type_mismatches = []
    for col in common:
        t_synth = synth_types.get(col)
        t_ref = ref_types.get(col)
        if t_synth != t_ref:
            type_mismatches.append({
                "column": col,
                "synthetic_type": t_synth,
                "reference_type": t_ref
            })
            
    all_cols_count = len(synth_cols.union(ref_cols))
    overlap_ratio = len(common) / max(1, all_cols_count)
    
    if overlap_ratio >= 0.70 and len(type_mismatches) == 0:
        compatibility = "HIGH"
    elif overlap_ratio >= 0.40 and len(type_mismatches) <= 2:
        compatibility = "MEDIUM"
    else:
        compatibility = "LOW"
        
    return {
        "common_columns_count": len(common),
        "synthetic_only_count": len(synth_only),
        "reference_only_count": len(ref_only),
        "type_mismatches_count": len(type_mismatches),
        "common_columns": common,
        "synthetic_only_columns": synth_only,
        "reference_only_columns": ref_only,
        "type_mismatches": type_mismatches,
        "schema_compatibility": compatibility,
        "overlap_ratio": round(overlap_ratio, 4)
    }

def compare_numeric_distributions(synth_df: pd.DataFrame, ref_df: pd.DataFrame, common_numeric_cols: List[str]) -> List[Dict[str, Any]]:
    """Calculates granular descriptive statistics and distribution tests for each numeric column."""
    results = []
    
    for col in common_numeric_cols:
        s_raw = pd.to_numeric(synth_df[col], errors='coerce').dropna()
        r_raw = pd.to_numeric(ref_df[col], errors='coerce').dropna()
        
        if len(s_raw) == 0 or len(r_raw) == 0:
            continue
            
        s_count = int(len(s_raw))
        r_count = int(len(r_raw))
        
        s_mean = float(s_raw.mean())
        r_mean = float(r_raw.mean())
        mean_diff = s_mean - r_mean
        mean_rel_diff_pct = (abs(mean_diff) / max(abs(r_mean), 1e-9)) * 100
        
        s_median = float(s_raw.median())
        r_median = float(r_raw.median())
        median_diff = s_median - r_median
        
        s_std = float(s_raw.std(ddof=1)) if s_count > 1 else 0.0
        r_std = float(r_raw.std(ddof=1)) if r_count > 1 else 0.0
        std_diff = s_std - r_std
        std_rel_diff_pct = (abs(std_diff) / max(abs(r_std), 1e-9)) * 100
        
        s_min = float(s_raw.min())
        r_min = float(r_raw.min())
        s_max = float(s_raw.max())
        r_max = float(r_raw.max())
        
        s_q1, s_q3 = float(s_raw.quantile(0.25)), float(s_raw.quantile(0.75))
        r_q1, r_q3 = float(r_raw.quantile(0.25)), float(r_raw.quantile(0.75))
        s_iqr = s_q3 - s_q1
        r_iqr = r_q3 - r_q1
        iqr_diff = s_iqr - r_iqr
        
        s_missing_pct = float((synth_df[col].isna().sum() / len(synth_df)) * 100)
        r_missing_pct = float((ref_df[col].isna().sum() / len(ref_df)) * 100)
        missing_diff_pct = s_missing_pct - r_missing_pct
        
        # Two-Sample Kolmogorov-Smirnov test
        ks_res = stats.ks_2samp(s_raw, r_raw)
        ks_stat = float(ks_res.statistic)
        ks_pvalue = float(ks_res.pvalue)
        
        # Wasserstein distance (Earth Mover's Distance)
        try:
            w_dist = float(stats.wasserstein_distance(s_raw, r_raw))
        except Exception:
            w_dist = 0.0
            
        # Quantiles (10, 25, 50, 75, 90, 99)
        quantiles = [0.10, 0.25, 0.50, 0.75, 0.90, 0.99]
        s_quantiles = {f"p{int(q*100)}": round(float(s_raw.quantile(q)), 2) for q in quantiles}
        r_quantiles = {f"p{int(q*100)}": round(float(r_raw.quantile(q)), 2) for q in quantiles}
        
        # Unified Histogram Bins (12 bins)
        global_min = min(s_min, r_min)
        global_max = max(s_max, r_max)
        if global_min == global_max:
            bins = [global_min - 1, global_max + 1]
        else:
            bins = np.linspace(global_min, global_max, 13)
            
        s_hist, _ = np.histogram(s_raw, bins=bins)
        r_hist, _ = np.histogram(r_raw, bins=bins)
        
        bin_labels = []
        for i in range(len(bins) - 1):
            b_start = round(float(bins[i]), 1)
            b_end = round(float(bins[i+1]), 1)
            bin_labels.append(f"{b_start} - {b_end}")
            
        s_hist_pct = [round((c / s_count) * 100, 2) for c in s_hist]
        r_hist_pct = [round((c / r_count) * 100, 2) for c in r_hist]
        
        results.append({
            "column": col,
            "synthetic": {
                "count": s_count,
                "mean": round(s_mean, 2),
                "median": round(s_median, 2),
                "std": round(s_std, 2),
                "min": round(s_min, 2),
                "max": round(s_max, 2),
                "q1": round(s_q1, 2),
                "q3": round(s_q3, 2),
                "iqr": round(s_iqr, 2),
                "missing_pct": round(s_missing_pct, 2)
            },
            "reference": {
                "count": r_count,
                "mean": round(r_mean, 2),
                "median": round(r_median, 2),
                "std": round(r_std, 2),
                "min": round(r_min, 2),
                "max": round(r_max, 2),
                "q1": round(r_q1, 2),
                "q3": round(r_q3, 2),
                "iqr": round(r_iqr, 2),
                "missing_pct": round(r_missing_pct, 2)
            },
            "deltas": {
                "mean_diff": round(mean_diff, 2),
                "mean_rel_diff_pct": round(mean_rel_diff_pct, 2),
                "median_diff": round(median_diff, 2),
                "std_diff": round(std_diff, 2),
                "std_rel_diff_pct": round(std_rel_diff_pct, 2),
                "iqr_diff": round(iqr_diff, 2),
                "missing_diff_pct": round(missing_diff_pct, 2)
            },
            "statistical_tests": {
                "ks_statistic": round(ks_stat, 4),
                "ks_pvalue": ks_pvalue,
                "ks_passed_similarity": bool(ks_stat <= 0.15),
                "wasserstein_distance": round(w_dist, 4)
            },
            "quantiles": {
                "synthetic": s_quantiles,
                "reference": r_quantiles
            },
            "histogram": {
                "bins": bin_labels,
                "synthetic_counts": [int(x) for x in s_hist],
                "reference_counts": [int(x) for x in r_hist],
                "synthetic_pct": s_hist_pct,
                "reference_pct": r_hist_pct
            }
        })
        
    return results

def compare_categorical_distributions(synth_df: pd.DataFrame, ref_df: pd.DataFrame, common_cat_cols: List[str]) -> List[Dict[str, Any]]:
    """Compares category proportions, detects missing and rare categories, and calculates TVD."""
    results = []
    
    for col in common_cat_cols:
        s_series = synth_df[col].dropna().astype(str)
        r_series = ref_df[col].dropna().astype(str)
        
        s_total = max(1, len(s_series))
        r_total = max(1, len(r_series))
        
        s_counts = s_series.value_counts()
        r_counts = r_series.value_counts()
        
        all_categories = sorted(list(set(s_counts.index).union(set(r_counts.index))))
        
        categories_comparison = []
        tvd_accum = 0.0
        missing_from_synthetic = []
        missing_from_reference = []
        rare_categories = []
        large_shifts = []
        
        for cat in all_categories:
            s_c = int(s_counts.get(cat, 0))
            r_c = int(r_counts.get(cat, 0))
            
            s_pct = round((s_c / s_total) * 100, 2)
            r_pct = round((r_c / r_total) * 100, 2)
            delta_pct = round(s_pct - r_pct, 2)
            
            tvd_accum += abs((s_c / s_total) - (r_c / r_total))
            
            if s_c == 0:
                missing_from_synthetic.append(cat)
            if r_c == 0:
                missing_from_reference.append(cat)
            if (s_pct < 1.0 and s_pct > 0) or (r_pct < 1.0 and r_pct > 0):
                rare_categories.append(cat)
            if abs(delta_pct) >= 5.0:
                large_shifts.append({
                    "category": cat,
                    "synthetic_pct": s_pct,
                    "reference_pct": r_pct,
                    "delta_pct": delta_pct
                })
                
            categories_comparison.append({
                "category": cat,
                "synthetic_count": s_c,
                "reference_count": r_c,
                "synthetic_pct": s_pct,
                "reference_pct": r_pct,
                "delta_pct": delta_pct
            })
            
        tvd = round(0.5 * tvd_accum, 4)
        
        # Sort categories by reference frequency descending
        categories_comparison.sort(key=lambda x: x["reference_count"], reverse=True)
        
        results.append({
            "column": col,
            "total_unique_categories": len(all_categories),
            "synthetic_unique_count": len(s_counts),
            "reference_unique_count": len(r_counts),
            "total_variation_distance": tvd,
            "categories": categories_comparison[:25], # Top 25 for report readability
            "missing_from_synthetic": missing_from_synthetic,
            "missing_from_reference": missing_from_reference,
            "rare_categories": rare_categories[:10],
            "large_frequency_shifts": large_shifts
        })
        
    return results

def compare_missingness(synth_df: pd.DataFrame, ref_df: pd.DataFrame, common_cols: List[str]) -> List[Dict[str, Any]]:
    """Compares missing values column-by-column."""
    results = []
    
    for col in common_cols:
        s_miss = int(synth_df[col].isna().sum())
        r_miss = int(ref_df[col].isna().sum())
        
        s_pct = round((s_miss / len(synth_df)) * 100, 2)
        r_pct = round((r_miss / len(ref_df)) * 100, 2)
        diff_pct = round(s_pct - r_pct, 2)
        
        is_substantial = abs(diff_pct) >= 1.5
        
        results.append({
            "column": col,
            "synthetic_missing_count": s_miss,
            "reference_missing_count": r_miss,
            "synthetic_missing_pct": s_pct,
            "reference_missing_pct": r_pct,
            "difference_pct": diff_pct,
            "is_substantial_discrepancy": is_substantial,
            "observation": f"Synthetic missingness is {'higher' if diff_pct > 0 else 'lower'} by {abs(diff_pct):.2f}% points" if is_substantial else "Missing rates are closely aligned"
        })
        
    return results

def compare_outliers(synth_df: pd.DataFrame, ref_df: pd.DataFrame, common_numeric_cols: List[str]) -> List[Dict[str, Any]]:
    """Detects and compares outliers using standard IQR method."""
    results = []
    
    for col in common_numeric_cols:
        s_raw = pd.to_numeric(synth_df[col], errors='coerce').dropna()
        r_raw = pd.to_numeric(ref_df[col], errors='coerce').dropna()
        
        if len(s_raw) == 0 or len(r_raw) == 0:
            continue
            
        s_q1, s_q3 = s_raw.quantile(0.25), s_raw.quantile(0.75)
        r_q1, r_q3 = r_raw.quantile(0.25), r_raw.quantile(0.75)
        
        s_iqr = s_q3 - s_q1
        r_iqr = r_q3 - r_q1
        
        s_lower, s_upper = s_q1 - 1.5 * s_iqr, s_q3 + 1.5 * s_iqr
        r_lower, r_upper = r_q1 - 1.5 * r_iqr, r_q3 + 1.5 * r_iqr
        
        s_outliers = int(((s_raw < s_lower) | (s_raw > s_upper)).sum())
        r_outliers = int(((r_raw < r_lower) | (r_raw > r_upper)).sum())
        
        s_outlier_pct = round((s_outliers / len(s_raw)) * 100, 2)
        r_outlier_pct = round((r_outliers / len(r_raw)) * 100, 2)
        outlier_diff_pct = round(s_outlier_pct - r_outlier_pct, 2)
        
        is_substantial = abs(outlier_diff_pct) >= 1.0
        
        results.append({
            "column": col,
            "synthetic_outliers_count": s_outliers,
            "reference_outliers_count": r_outliers,
            "synthetic_outlier_pct": s_outlier_pct,
            "reference_outlier_pct": r_outlier_pct,
            "outlier_diff_pct": outlier_diff_pct,
            "synthetic_bounds": {"lower": round(float(s_lower), 2), "upper": round(float(s_upper), 2)},
            "reference_bounds": {"lower": round(float(r_lower), 2), "upper": round(float(r_upper), 2)},
            "is_substantial_discrepancy": is_substantial,
            "characterization": "Potential distribution difference: outlier frequency divergence" if is_substantial else "Outlier proportions comparable"
        })
        
    return results

def compare_correlations(synth_df: pd.DataFrame, ref_df: pd.DataFrame, common_numeric_cols: List[str]) -> Dict[str, Any]:
    """Computes correlation matrices and tracks preserved vs altered pairwise relationships."""
    if len(common_numeric_cols) < 2:
        return {
            "columns": common_numeric_cols,
            "synthetic_matrix": {},
            "reference_matrix": {},
            "differences": [],
            "preserved_ratio": 1.0
        }
        
    s_corr = synth_df[common_numeric_cols].apply(pd.to_numeric, errors='coerce').corr().fillna(0)
    r_corr = ref_df[common_numeric_cols].apply(pd.to_numeric, errors='coerce').corr().fillna(0)
    
    pairwise_diffs = []
    preserved_count = 0
    total_pairs = 0
    
    cols = common_numeric_cols
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            c1, c2 = cols[i], cols[j]
            s_val = float(s_corr.loc[c1, c2])
            r_val = float(r_corr.loc[c1, c2])
            delta = round(s_val - r_val, 4)
            abs_delta = abs(delta)
            
            total_pairs += 1
            if abs_delta <= 0.15:
                status = "Preserved"
                preserved_count += 1
            elif abs_delta > 0.40:
                status = "Divergent"
            elif abs(s_val) < abs(r_val):
                status = "Weakened"
            else:
                status = "Strengthened"
                
            pairwise_diffs.append({
                "pair": f"{c1} ↔ {c2}",
                "column_1": c1,
                "column_2": c2,
                "synthetic_correlation": round(s_val, 3),
                "reference_correlation": round(r_val, 3),
                "difference": round(delta, 3),
                "relationship_status": status
            })
            
    # Sort pairs by largest correlation discrepancy
    pairwise_diffs.sort(key=lambda x: abs(x["difference"]), reverse=True)
    preserved_ratio = round(preserved_count / max(1, total_pairs), 3)
    
    return {
        "columns": common_numeric_cols,
        "synthetic_matrix": s_corr.round(3).to_dict(),
        "reference_matrix": r_corr.round(3).to_dict(),
        "differences": pairwise_diffs,
        "preserved_ratio": preserved_ratio,
        "total_pairs": total_pairs,
        "preserved_pairs_count": preserved_count
    }

def detect_potential_issues(
    schema_analysis: Dict[str, Any],
    numeric_comp: List[Dict[str, Any]],
    cat_comp: List[Dict[str, Any]],
    missing_comp: List[Dict[str, Any]],
    outlier_comp: List[Dict[str, Any]],
    corr_comp: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Identifies factual, evidence-backed potential data quality or fidelity issues."""
    issues = []
    
    # 1. Schema Issues
    if schema_analysis["reference_only_count"] > 0:
        issues.append({
            "category": "Schema Issues",
            "type": "Missing Reference Columns",
            "severity": "Medium",
            "column": ", ".join(schema_analysis["reference_only_columns"][:3]),
            "evidence": f"{schema_analysis['reference_only_count']} columns present in Reference dataset are absent in Synthetic dataset ({', '.join(schema_analysis['reference_only_columns'])}).",
            "interpretation": "Downstream models expecting these reference features will fail without feature imputation or alignment."
        })
        
    for tm in schema_analysis["type_mismatches"]:
        issues.append({
            "category": "Schema Issues",
            "type": "Data-Type Mismatch",
            "severity": "High",
            "column": tm["column"],
            "evidence": f"Column '{tm['column']}' inferred as '{tm['synthetic_type']}' in synthetic vs '{tm['reference_type']}' in reference.",
            "interpretation": "Direct type casting mismatch will trip downstream schema validators and ingestion parsers."
        })
        
    # 2. Distribution Issues
    for item in numeric_comp:
        col = item["column"]
        ks_stat = item["statistical_tests"]["ks_statistic"]
        mean_rel = item["deltas"]["mean_rel_diff_pct"]
        s_mean = item["synthetic"]["mean"]
        r_mean = item["reference"]["mean"]
        
        if ks_stat > 0.25:
            issues.append({
                "category": "Distribution Issues",
                "type": "Distribution Drift (High KS)",
                "severity": "High" if ks_stat > 0.40 else "Medium",
                "column": col,
                "evidence": f"Kolmogorov-Smirnov distance is D={ks_stat:.3f} (exceeds 0.25 boundary). Synthetic mean is {s_mean} vs Reference mean {r_mean} ({item['deltas']['mean_diff']:+0.2f}, {mean_rel:.1f}% relative difference).",
                "interpretation": f"Empirical cumulative distribution of '{col}' significantly deviates from the reference dataset."
            })
        elif mean_rel > 18.0:
            issues.append({
                "category": "Distribution Issues",
                "type": "Notable Mean Difference",
                "severity": "Medium",
                "column": col,
                "evidence": f"Synthetic mean {s_mean} differs from reference mean {r_mean} by {mean_rel:.1f}%.",
                "interpretation": f"The central location of '{col}' in the synthetic data has shifted relative to the reference."
            })
            
    # 3. Categorical Issues
    for item in cat_comp:
        col = item["column"]
        if item["missing_from_synthetic"]:
            issues.append({
                "category": "Distribution Issues",
                "type": "Missing Category in Synthetic",
                "severity": "Medium",
                "column": col,
                "evidence": f"Categories present in reference are omitted in synthetic: {', '.join(item['missing_from_synthetic'][:4])}.",
                "interpretation": "Class imbalance or zero-frequency categories will affect model generalization to rare classes."
            })
        if item["total_variation_distance"] > 0.20:
            issues.append({
                "category": "Distribution Issues",
                "type": "Categorical Proportion Drift",
                "severity": "Medium",
                "column": col,
                "evidence": f"Total Variation Distance for '{col}' is {item['total_variation_distance']:.3f} (exceeds 0.20 threshold).",
                "interpretation": "Marginal frequencies of categorical states deviate noticeably between synthetic and reference."
            })
            
    # 4. Data Quality / Missingness Issues
    for item in missing_comp:
        col = item["column"]
        diff = item["difference_pct"]
        if abs(diff) >= 3.0:
            issues.append({
                "category": "Data Quality Issues",
                "type": "Missingness Discrepancy",
                "severity": "Medium" if abs(diff) < 8.0 else "High",
                "column": col,
                "evidence": f"Synthetic missingness is {item['synthetic_missing_pct']}% vs Reference {item['reference_missing_pct']}% (delta: {diff:+0.2f}%).",
                "interpretation": f"Potential mismatch: null rate for '{col}' is noticeably {'higher' if diff > 0 else 'lower'} in the synthetic dataset."
            })
            
    # 5. Relationship / Correlation Issues
    for pair in corr_comp.get("differences", []):
        diff = abs(pair["difference"])
        if diff >= 0.35:
            issues.append({
                "category": "Relationship Issues",
                "type": "Correlation Mismatch",
                "severity": "High" if diff >= 0.50 else "Medium",
                "column": pair["pair"],
                "evidence": f"{pair['pair']}: Synthetic correlation is {pair['synthetic_correlation']} vs Reference {pair['reference_correlation']} (delta: {pair['difference']:+0.2f}).",
                "interpretation": "Multivariate inter-feature dependency present in the reference dataset is altered in the synthetic dataset."
            })
            
    return issues

def identify_risk_areas(
    schema_analysis: Dict[str, Any],
    numeric_comp: List[Dict[str, Any]],
    cat_comp: List[Dict[str, Any]],
    missing_comp: List[Dict[str, Any]],
    outlier_comp: List[Dict[str, Any]],
    corr_comp: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generates structured synthetic data risk cards across defined risk dimensions."""
    risk_cards = []
    
    # 1. Distribution Drift
    drifted_numeric = [item for item in numeric_comp if item["statistical_tests"]["ks_statistic"] > 0.20]
    if drifted_numeric:
        worst = max(drifted_numeric, key=lambda x: x["statistical_tests"]["ks_statistic"])
        ks = worst["statistical_tests"]["ks_statistic"]
        risk_cards.append({
            "category": "Distribution Drift",
            "severity": "High" if ks > 0.35 else "Medium",
            "affected_column": worst["column"],
            "synthetic_value": f"Mean: {worst['synthetic']['mean']}, Std: {worst['synthetic']['std']}",
            "reference_value": f"Mean: {worst['reference']['mean']}, Std: {worst['reference']['std']}",
            "evidence": f"KS statistic D={ks:.3f} indicates cumulative density divergence.",
            "recommended_investigation": "Inspect generation seed and distribution parameters for quantile calibration."
        })
        
    # 2. Missingness Mismatch
    miss_discrepant = [m for m in missing_comp if abs(m["difference_pct"]) >= 2.0]
    if miss_discrepant:
        worst_m = max(miss_discrepant, key=lambda x: abs(x["difference_pct"]))
        risk_cards.append({
            "category": "Missingness Mismatch",
            "severity": "Medium" if abs(worst_m["difference_pct"]) < 6.0 else "High",
            "affected_column": worst_m["column"],
            "synthetic_value": f"{worst_m['synthetic_missing_pct']}% null",
            "reference_value": f"{worst_m['reference_missing_pct']}% null",
            "evidence": f"Null rate disparity of {worst_m['difference_pct']:+0.2f}% points.",
            "recommended_investigation": "Adjust null dropout parameters in generator specification for target column."
        })
        
    # 3. Category Imbalance
    imbalanced_cat = [c for c in cat_comp if c["missing_from_synthetic"] or c["total_variation_distance"] > 0.15]
    if imbalanced_cat:
        worst_c = max(imbalanced_cat, key=lambda x: x["total_variation_distance"])
        risk_cards.append({
            "category": "Category Imbalance",
            "severity": "High" if worst_c["missing_from_synthetic"] else "Medium",
            "affected_column": worst_c["column"],
            "synthetic_value": f"{worst_c['synthetic_unique_count']} unique categories",
            "reference_value": f"{worst_c['reference_unique_count']} unique categories",
            "evidence": f"TVD={worst_c['total_variation_distance']:.3f}. Missing in synthetic: {', '.join(worst_c['missing_from_synthetic'][:3]) or 'None'}.",
            "recommended_investigation": "Verify categorical support domain and frequency priors in synthesis engine."
        })
        
    # 4. Outlier Mismatch
    outlier_discrepant = [o for o in outlier_comp if o["is_substantial_discrepancy"]]
    if outlier_discrepant:
        worst_o = max(outlier_discrepant, key=lambda x: abs(x["outlier_diff_pct"]))
        risk_cards.append({
            "category": "Outlier Mismatch",
            "severity": "Medium",
            "affected_column": worst_o["column"],
            "synthetic_value": f"{worst_o['synthetic_outlier_pct']}% ({worst_o['synthetic_outliers_count']} rows)",
            "reference_value": f"{worst_o['reference_outlier_pct']}% ({worst_o['reference_outliers_count']} rows)",
            "evidence": f"IQR outlier rate differs by {worst_o['outlier_diff_pct']:+0.2f}% points.",
            "recommended_investigation": "Evaluate heavy-tail Pareto or extreme-value injection limits."
        })
        
    # 5. Correlation Mismatch
    corr_divergent = [c for c in corr_comp.get("differences", []) if abs(c["difference"]) >= 0.25]
    if corr_divergent:
        worst_corr = corr_divergent[0]
        risk_cards.append({
            "category": "Correlation Mismatch",
            "severity": "High" if abs(worst_corr["difference"]) >= 0.45 else "Medium",
            "affected_column": worst_corr["pair"],
            "synthetic_value": f"r = {worst_corr['synthetic_correlation']:.2f}",
            "reference_value": f"r = {worst_corr['reference_correlation']:.2f}",
            "evidence": f"Pairwise correlation delta is {worst_corr['difference']:+0.2f}.",
            "recommended_investigation": "Incorporate copula or multivariate joint covariance modeling into generator."
        })
        
    # 6. Schema Mismatch
    if schema_analysis["reference_only_count"] > 0 or schema_analysis["type_mismatches_count"] > 0:
        risk_cards.append({
            "category": "Schema Mismatch",
            "severity": "High" if schema_analysis["type_mismatches_count"] > 0 else "Low",
            "affected_column": "Schema Definition",
            "synthetic_value": f"{schema_analysis['common_columns_count']} common, {schema_analysis['synthetic_only_count']} synthetic-only",
            "reference_value": f"{schema_analysis['reference_only_count']} missing reference columns",
            "evidence": f"Schema compatibility evaluated as {schema_analysis['schema_compatibility']}.",
            "recommended_investigation": "Align column names and types with reference specification before training."
        })
        
    return risk_cards

def calculate_statistical_similarity_index(
    schema_analysis: Dict[str, Any],
    numeric_comp: List[Dict[str, Any]],
    cat_comp: List[Dict[str, Any]],
    missing_comp: List[Dict[str, Any]],
    corr_comp: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes a composite Statistical Similarity Index (0 - 100) based strictly on mathematical alignment.
    Explicitly clarifies what the index measures and what it does NOT mean.
    """
    # 1. Schema score (25%)
    schema_score = schema_analysis["overlap_ratio"] * 100
    if schema_analysis["type_mismatches_count"] > 0:
        schema_score = max(0, schema_score - schema_analysis["type_mismatches_count"] * 15)
        
    # 2. Distribution score (35%): derived from 1 - average KS statistic
    if numeric_comp:
        avg_ks = np.mean([item["statistical_tests"]["ks_statistic"] for item in numeric_comp])
        dist_score = max(0.0, min(100.0, (1.0 - avg_ks) * 100.0))
    else:
        dist_score = 80.0
        
    # 3. Categorical score (15%): derived from 1 - average TVD
    if cat_comp:
        avg_tvd = np.mean([item["total_variation_distance"] for item in cat_comp])
        cat_score = max(0.0, min(100.0, (1.0 - avg_tvd) * 100.0))
    else:
        cat_score = 85.0
        
    # 4. Correlation score (15%): preserved pairs ratio
    corr_score = corr_comp.get("preserved_ratio", 1.0) * 100.0
    
    # 5. Missingness score (10%): 100 - average missing difference
    if missing_comp:
        avg_miss_diff = np.mean([abs(m["difference_pct"]) for m in missing_comp])
        miss_score = max(0.0, 100.0 - (avg_miss_diff * 4.0))
    else:
        miss_score = 90.0
        
    overall_index = round(
        0.25 * schema_score +
        0.35 * dist_score +
        0.15 * cat_score +
        0.15 * corr_score +
        0.10 * miss_score,
        1
    )
    
    return {
        "index_value": overall_index,
        "label": "Statistical Similarity Index",
        "contributing_components": {
            "schema_alignment": round(schema_score, 1),
            "numeric_distributions": round(dist_score, 1),
            "categorical_fidelity": round(cat_score, 1),
            "correlation_preservation": round(corr_score, 1),
            "missingness_alignment": round(miss_score, 1)
        },
        "interpretation_disclaimer": "This index reflects overall statistical closeness across evaluated numeric, categorical, and correlation metrics. It is NOT an 'accuracy score' and does not imply the synthetic dataset is identical to or certified for production without task-specific validation."
    }

def generate_executive_summary(
    schema_analysis: Dict[str, Any],
    numeric_comp: List[Dict[str, Any]],
    cat_comp: List[Dict[str, Any]],
    missing_comp: List[Dict[str, Any]],
    corr_comp: Dict[str, Any],
    similarity_index: Dict[str, Any]
) -> Dict[str, Any]:
    """Generates concise, factual executive summary strictly derived from calculated metrics."""
    # Count close numeric distributions (KS <= 0.20)
    close_num = sum(1 for item in numeric_comp if item["statistical_tests"]["ks_statistic"] <= 0.20)
    total_num = len(numeric_comp)
    
    # Count close categorical distributions (TVD <= 0.15)
    close_cat = sum(1 for item in cat_comp if item["total_variation_distance"] <= 0.15)
    total_cat = len(cat_comp)
    
    # Count notable missingness discrepancies (>= 2.0%)
    notable_miss = sum(1 for m in missing_comp if abs(m["difference_pct"]) >= 2.0)
    
    # Key findings
    findings = []
    if schema_analysis["common_columns_count"] > 0:
        findings.append(f"Schema compatibility is {schema_analysis['schema_compatibility']} with {schema_analysis['common_columns_count']} overlapping columns.")
    
    if total_num > 0:
        findings.append(f"{close_num} of {total_num} numeric columns show close distribution characteristics (KS ≤ 0.20).")
        
    if total_cat > 0:
        findings.append(f"{close_cat} of {total_cat} categorical columns show matching category proportions (TVD ≤ 0.15).")
        
    if notable_miss > 0:
        findings.append(f"{notable_miss} columns show notable missingness differences (≥ 2.0% points).")
    else:
        findings.append("Missingness rates across common attributes are closely aligned.")
        
    preserved_corr_pct = int(corr_comp.get("preserved_ratio", 1.0) * 100)
    findings.append(f"{preserved_corr_pct}% of evaluated pairwise correlations are preserved within ±0.15 delta.")

    return {
        "dataset_compatibility": f"Schema: {schema_analysis['schema_compatibility']}",
        "numeric_summary": f"{close_num} of {total_num} columns show close statistical characteristics." if total_num > 0 else "No common numeric columns.",
        "categorical_summary": f"{close_cat} of {total_cat} columns show similar category proportions." if total_cat > 0 else "No common categorical columns.",
        "missingness_summary": f"{notable_miss} columns show notable differences." if notable_miss > 0 else "Missingness distributions are aligned.",
        "correlation_summary": f"{preserved_corr_pct}% of evaluated inter-column correlations are preserved.",
        "key_findings": findings
    }

def generate_use_case_recommendations(
    similarity_index: float,
    schema_compat: str,
    numeric_comp: List[Dict[str, Any]],
    corr_comp: Dict[str, Any]
) -> Dict[str, List[str]]:
    """Provides grounded recommendations based on measured statistical alignment."""
    suitable = [
        "Data pipeline integration and ETL resilience testing",
        "Application QA, end-to-end integration, and UI testing",
        "Stress testing boundary conditions and database indexing"
    ]
    
    caution = []
    
    if similarity_index >= 70.0 and schema_compat in ['HIGH', 'MEDIUM']:
        suitable.append("Exploratory data analysis and basic baseline ML prototyping")
    else:
        caution.append("Baseline ML experimentation: lower overall statistical similarity may bias feature importance")
        
    if corr_comp.get("preserved_ratio", 1.0) < 0.65:
        caution.append("Multi-feature predictive modeling: significant correlation divergence observed between attributes")
    else:
        suitable.append("Preliminary multivariate modeling and regression sanity checks")
        
    avg_ks = np.mean([item["statistical_tests"]["ks_statistic"] for item in numeric_comp]) if numeric_comp else 0.0
    if avg_ks > 0.25:
        caution.append("Distribution-sensitive ML evaluation: empirical density tails diverge noticeably from reference")
    else:
        suitable.append("Feature transformation and normalization validation")
        
    caution.append("Production-critical credit or fraud model threshold calibration without domain re-anchoring")
    
    return {
        "suitable_for": suitable,
        "use_with_caution": caution
    }

def run_full_validation_comparison(
    synth_bytes: bytes,
    synth_filename: str,
    ref_bytes: bytes,
    ref_filename: str
) -> Dict[str, Any]:
    """Executes end-to-end statistical comparison across uploaded Synthetic and Reference datasets."""
    # 1. Load DataFrames
    synth_df = load_dataframe(synth_bytes, synth_filename)
    ref_df = load_dataframe(ref_bytes, ref_filename)
    
    # 2. Extract Previews
    synth_preview = extract_preview(synth_df, synth_filename, len(synth_bytes))
    ref_preview = extract_preview(ref_df, ref_filename, len(ref_bytes))
    
    # 3. Schema Analysis
    schema_analysis = analyze_schemas(synth_df, ref_df)
    common_cols = schema_analysis["common_columns"]
    
    if len(common_cols) == 0:
        raise ValueError("No comparable common columns were detected between the uploaded datasets. Please ensure both files share at least one column header.")
        
    # Detect common numeric and categorical columns
    synth_types = synth_preview["column_types"]
    ref_types = ref_preview["column_types"]
    
    common_numeric = [c for c in common_cols if synth_types.get(c) == 'numeric' and ref_types.get(c) == 'numeric']
    common_categorical = [c for c in common_cols if synth_types.get(c) in ['categorical', 'boolean'] and ref_types.get(c) in ['categorical', 'boolean']]
    
    # 4. Statistical Computations
    numeric_comp = compare_numeric_distributions(synth_df, ref_df, common_numeric)
    cat_comp = compare_categorical_distributions(synth_df, ref_df, common_categorical)
    missing_comp = compare_missingness(synth_df, ref_df, common_cols)
    outlier_comp = compare_outliers(synth_df, ref_df, common_numeric)
    corr_comp = compare_correlations(synth_df, ref_df, common_numeric)
    
    # 5. Synthesis and Recommendations
    similarity_index = calculate_statistical_similarity_index(schema_analysis, numeric_comp, cat_comp, missing_comp, corr_comp)
    issues = detect_potential_issues(schema_analysis, numeric_comp, cat_comp, missing_comp, outlier_comp, corr_comp)
    risk_areas = identify_risk_areas(schema_analysis, numeric_comp, cat_comp, missing_comp, outlier_comp, corr_comp)
    summary = generate_executive_summary(schema_analysis, numeric_comp, cat_comp, missing_comp, corr_comp, similarity_index)
    recommendations = generate_use_case_recommendations(similarity_index["index_value"], schema_analysis["schema_compatibility"], numeric_comp, corr_comp)
    
    comparison_id = f"cmp_{synth_preview['row_count']}_{ref_preview['row_count']}_{int(pd.Timestamp.now().timestamp())}"
    
    return {
        "id": comparison_id,
        "timestamp": pd.Timestamp.now().isoformat(),
        "disclaimer": "Statistical comparison is performed on uploaded datasets. The reference dataset is treated as a comparison source, not ground truth.",
        "previews": {
            "synthetic": synth_preview,
            "reference": ref_preview
        },
        "schema_analysis": schema_analysis,
        "similarity_index": similarity_index,
        "executive_summary": summary,
        "numeric_comparison": numeric_comp,
        "categorical_comparison": cat_comp,
        "missing_comparison": missing_comp,
        "outlier_comparison": outlier_comp,
        "correlation_comparison": corr_comp,
        "potential_issues": issues,
        "risk_areas": risk_areas,
        "recommendations": recommendations
    }
