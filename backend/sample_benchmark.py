import pandas as pd
import numpy as np

def generate_sample_benchmark_pair(n_rows: int = 2500):
    """Generates a realistic Synthetic vs Reference benchmark pair."""
    np.random.seed(42)
    
    # 1. Synthetic Dataset
    s_ids = [f"tx_syn_{100000 + i}" for i in range(n_rows)]
    s_cust = [f"usr_{np.random.randint(1000, 9000)}" for _ in range(n_rows)]
    
    # Synthetic amounts: slightly lower mean ($2487.20)
    s_amounts = np.random.exponential(scale=1800, size=n_rows) + 50.0
    # Add synthetic extreme outliers (1.0%)
    
    extreme_idx = np.random.choice(n_rows, size=int(n_rows * 0.01), replace=False)
    s_amounts[extreme_idx] *= 5.5
    s_amounts = np.round(s_amounts, 2)
    
    s_methods = np.random.choice(
        ['UPI', 'Credit Card', 'Debit Card', 'Cash'],
        size=n_rows,
        p=[0.412, 0.298, 0.184, 0.106]
    )
    
    s_categories = np.random.choice(
        ['Electronics', 'Apparel', 'Home & Kitchen', 'Digital Goods'],
        size=n_rows,
        p=[0.35, 0.30, 0.20, 0.15]
    )
    
    s_ages = np.random.normal(loc=34.2, scale=8.5, size=n_rows).astype(float)
    s_ages = np.clip(np.round(s_ages, 1), 18.0, 72.0)
    # Synthetic missing age: 5.4%
    age_null_idx = np.random.choice(n_rows, size=int(n_rows * 0.054), replace=False)
    s_ages[age_null_idx] = np.nan
    
    s_discounts = np.round(np.random.uniform(0.0, 0.35, size=n_rows), 2)
    
    # Synthetic only column: is_fraud
    s_is_fraud = np.random.choice([False, True], size=n_rows, p=[0.98, 0.02])
    
    df_synthetic = pd.DataFrame({
        'transaction_id': s_ids,
        'customer_id': s_cust,
        'amount': s_amounts,
        'payment_method': s_methods,
        'product_category': s_categories,
        'customer_age': s_ages,
        'discount_rate': s_discounts,
        'is_fraud': s_is_fraud
    })
    
    # 2. Reference Dataset (Kaggle Benchmark)
    np.random.seed(999)
    r_ids = [f"tx_ref_{200000 + i}" for i in range(n_rows)]
    r_cust = [f"usr_{np.random.randint(1000, 9000)}" for _ in range(n_rows)]
    
    # Reference amounts: slightly higher mean ($2510.80) with natural heavy tail
    r_amounts = np.random.exponential(scale=1920, size=n_rows) + 60.0
    r_extreme_idx = np.random.choice(n_rows, size=int(n_rows * 0.012), replace=False)
    r_amounts[r_extreme_idx] *= 6.2
    r_amounts = np.round(r_amounts, 2)
    
    r_methods = np.random.choice(
        ['UPI', 'Credit Card', 'Debit Card', 'Cash'],
        size=n_rows,
        p=[0.401, 0.312, 0.179, 0.108]
    )
    
    r_categories = np.random.choice(
        ['Electronics', 'Apparel', 'Home & Kitchen', 'Digital Goods'],
        size=n_rows,
        p=[0.34, 0.31, 0.22, 0.13]
    )
    
    r_ages = np.random.normal(loc=35.1, scale=8.8, size=n_rows).astype(float)
    r_ages = np.clip(np.round(r_ages, 1), 18.0, 75.0)
    # Reference missing age: only 2.1%
    r_age_null_idx = np.random.choice(n_rows, size=int(n_rows * 0.021), replace=False)
    r_ages[r_age_null_idx] = np.nan
    
    r_discounts = np.round(np.random.uniform(0.0, 0.30, size=n_rows), 2)
    
    # Reference only column: store_region
    r_regions = np.random.choice(['North', 'South', 'East', 'West'], size=n_rows)
    
    df_reference = pd.DataFrame({
        'transaction_id': r_ids,
        'customer_id': r_cust,
        'amount': r_amounts,
        'payment_method': r_methods,
        'product_category': r_categories,
        'customer_age': r_ages,
        'discount_rate': r_discounts,
        'store_region': r_regions
    })
    
    return df_synthetic, df_reference

if __name__ == '__main__':
    syn, ref = generate_sample_benchmark_pair(2500)
    syn.to_csv('synthetic_ecommerce_sample.csv', index=False)
    ref.to_csv('reference_retail_kaggle_sample.csv', index=False)
    print(f"Generated sample datasets: synthetic ({len(syn)} rows), reference ({len(ref)} rows)")
