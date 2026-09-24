import json
import urllib.request
import os
import sys

# Test calling the live Gemini API endpoint
payload = {
    "prompt": "Create an e-commerce transaction dataset with 10,000 rows, 2% fraud, weekend sales increase, missing emails and extreme transactions.",
    "seed": 582941
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/ai/parse",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        print("GEMINI_API_RESPONSE_STATUS:", res_data.get("status"))
        print("MODEL_USED:", res_data.get("model"))
        print("SOURCE:", res_data.get("source"))
        spec = res_data.get("specification", {})
        print("DOMAIN:", spec.get("domain"))
        print("ROWS:", spec.get("totalRows"))
        print("SCHEMA_COLUMNS:", [c["name"] for c in spec.get("schema", [])])
        print("EDGE_CASES:", json.dumps(spec.get("edgeCases", {}), indent=2))
        
        # Save spec to disk for verification
        with open("gemini_parsed_spec.json", "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)
        print("Saved specification to gemini_parsed_spec.json")

except Exception as e:
    print("ERROR calling Gemini API endpoint:", e)
