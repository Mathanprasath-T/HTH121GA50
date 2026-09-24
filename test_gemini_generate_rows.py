import urllib.request
import json

payload = {
    "prompt": "Create an e-commerce transaction dataset with 10,000 rows, 2% fraud, weekend sales increase, missing emails and extreme transactions.",
    "schema": [
        {"name": "transaction_id", "type": "uuid"},
        {"name": "customer_id", "type": "uuid"},
        {"name": "timestamp", "type": "timestamp"},
        {"name": "amount", "type": "decimal"},
        {"name": "payment_method", "type": "categorical"},
        {"name": "product_category", "type": "categorical"},
        {"name": "customer_email", "type": "varchar"},
        {"name": "is_fraud", "type": "boolean"}
    ],
    "count": 5,
    "edgeCases": {
        "fraudRate": 2.0,
        "missingValuesRate": 2.0
    }
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/ai/generate_rows",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
        print("SUCCESS:", data.get("success"))
        print("MODEL_USED:", data.get("model"))
        print("ROWS_RETURNED:", data.get("count"))
        print("SAMPLE_RECORD_1:", json.dumps(data.get("records", [])[0], indent=2))
except Exception as e:
    print("ERROR:", e)
