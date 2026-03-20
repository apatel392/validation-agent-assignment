from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import os
import uuid
import time
import random
from datetime import datetime, timezone

app = FastAPI()

# Enable CORS so the React frontend can talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File paths
PAYLOADS_FILE = "payloads.json"
LOGS_FILE = "logs.jsonl"

# --- Helper Functions for File I/O ---
def read_payloads():
    if not os.path.exists(PAYLOADS_FILE):
        return []
    try:
        with open(PAYLOADS_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def write_payloads(data):
    with open(PAYLOADS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def log_validation(request_data, response_data):
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request": request_data,
        "response": response_data
    }
    with open(LOGS_FILE, "a") as f:
        f.write(json.dumps(log_entry) + "\n")


# --- Models ---
class SavedPayload(BaseModel):
    name: str
    schema_type: str  # Note: renamed from 'schema' as it's a reserved word in some contexts
    json_data: Dict[str, Any]

class ValidateRequest(BaseModel):
    schema_name: str
    payload: Dict[str, Any]


# --- CRUD Endpoints for Saved Payloads ---
@app.get("/payloads")
def get_payloads():
    return read_payloads()

@app.post("/payloads")
def create_payload(payload: SavedPayload):
    data = read_payloads()
    new_item = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "schema": payload.schema_type,
        "json": payload.json_data
    }
    data.append(new_item)
    write_payloads(data)
    return new_item

@app.put("/payloads/{payload_id}")
def update_payload(payload_id: str, payload: SavedPayload):
    data = read_payloads()
    for item in data:
        if item.get("id") == payload_id:
            item["name"] = payload.name
            item["schema"] = payload.schema_type
            item["json"] = payload.json_data
            write_payloads(data)
            return item
    raise HTTPException(status_code=404, detail="Payload not found")

@app.delete("/payloads/{payload_id}")
def delete_payload(payload_id: str):
    data = read_payloads()
    new_data = [item for item in data if item.get("id") != payload_id]
    if len(data) == len(new_data):
        raise HTTPException(status_code=404, detail="Payload not found")
    write_payloads(new_data)
    return {"status": "deleted"}


# --- Validation Logic ---
def validate_user_profile(payload: dict):
    errors = []
    
    # Required fields & Types
    if "id" not in payload or not isinstance(payload["id"], str):
        errors.append({"field": "id", "message": "Missing or must be a string"})
    
    if "email" not in payload or not isinstance(payload["email"], str):
        errors.append({"field": "email", "message": "Missing or must be a string"})
    elif "@" not in payload["email"]:
        errors.append({"field": "email", "message": "Must contain '@'"})
        
    if "age" not in payload or not isinstance(payload["age"], (int, float)):
        errors.append({"field": "age", "message": "Missing or must be a number"})
    else:
        # Check if age is an integer between 13 and 120
        if not (isinstance(payload["age"], int) or payload["age"].is_integer()):
            errors.append({"field": "age", "message": "Must be an integer"})
        elif not (13 <= payload["age"] <= 120):
            errors.append({"field": "age", "message": "Must be between 13 and 120 (inclusive)"})

    if "country" not in payload or not isinstance(payload["country"], str):
        errors.append({"field": "country", "message": "Missing or must be a string"})
    elif payload["country"] not in ["US", "IN", "UK"]:
        errors.append({"field": "country", "message": "Must be one of: 'US', 'IN', 'UK'"})

    summary = {
        "id": payload.get("id"),
        "email": payload.get("email"),
        "country": payload.get("country")
    }
    
    return errors, [], summary

def validate_order(payload: dict):
    errors = []
    
    if "order_id" not in payload or not isinstance(payload["order_id"], str):
        errors.append({"field": "order_id", "message": "Missing or must be a string"})
        
    if "items" not in payload or not isinstance(payload["items"], list):
        errors.append({"field": "items", "message": "Missing or must be an array"})
    elif len(payload["items"]) < 1:
        errors.append({"field": "items", "message": "Length must be >= 1"})
    else:
        calculated_total = 0.0
        for i, item in enumerate(payload["items"]):
            if not isinstance(item, dict):
                errors.append({"field": f"items[{i}]", "message": "Must be an object"})
                continue
            
            # Check item fields
            qty = item.get("qty")
            price = item.get("price")
            
            if qty is None or not isinstance(qty, (int, float)) or (isinstance(qty, float) and not qty.is_integer()) or qty < 1:
                errors.append({"field": f"items[{i}].qty", "message": "Must be an integer >= 1"})
            if price is None or not isinstance(price, (int, float)):
                errors.append({"field": f"items[{i}].price", "message": "Must be a number"})
                
            if isinstance(qty, (int, float)) and isinstance(price, (int, float)):
                calculated_total += (qty * price)

    if "total" not in payload or not isinstance(payload["total"], (int, float)):
        errors.append({"field": "total", "message": "Missing or must be a number"})
    elif "items" in payload and isinstance(payload["items"], list) and len(payload["items"]) >= 1:
        # Check tolerance (0.01)
        if abs(payload["total"] - calculated_total) > 0.01:
             errors.append({"field": "total", "message": f"Must equal sum(qty * price). Expected approx {calculated_total:.2f}"})

    summary = {
        "order_id": payload.get("order_id"),
        "item_count": len(payload.get("items", [])),
        "total": payload.get("total")
    }

    return errors, [], summary


# --- Validation Endpoint ---
@app.post("/validate")
async def validate_payload(req: Request):
    start_time = time.time()
    
    # Simulate Latency (150ms to 500ms)
    time.sleep(random.uniform(0.15, 0.5))
    
    try:
        body = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON format")

    schema_name = body.get("schema")
    payload = body.get("payload", {})
    
    if schema_name not in ["user_profile", "order"]:
        return {
            "ok": False,
            "errors": [{"field": "schema", "message": "Must be 'user_profile' or 'order'"}],
            "warnings": [],
            "summary": {},
            "latency_ms": int((time.time() - start_time) * 1000),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    if schema_name == "user_profile":
        errors, warnings, summary = validate_user_profile(payload)
    else:
        errors, warnings, summary = validate_order(payload)

    response_data = {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "summary": summary if len(errors) == 0 else {},
        "latency_ms": int((time.time() - start_time) * 1000),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Log to JSONL file
    log_validation(body, response_data)

    return response_data