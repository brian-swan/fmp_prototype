from fastapi import FastAPI, HTTPException, Depends, Header, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import uuid
import json
import time
from datetime import datetime
import os

# Global storage for the prototype
flags_db = {}
environments_db = {}
segments_db = {}

# Sample data loading function
def load_sample_data():
    # Create sample environment
    prod_env = Environment(id="prod", name="Production")
    environments_db[prod_env.id] = prod_env.dict()
    
    # Create sample flags
    sample_flags = [
        FeatureFlag(
            id="flag-1",
            key="new-checkout",
            name="New Checkout Experience",
            description="Enable the new checkout flow",
            enabled=True,
            variations=[
                FlagVariation(
                    id="var-1",
                    name="On",
                    value=FlagValue(value=True, type="boolean")
                ),
                FlagVariation(
                    id="var-2",
                    name="Off",
                    value=FlagValue(value=False, type="boolean")
                )
            ],
            default_variation_id="var-2",  # Default to off
            rules=[
                {
                    "id": "rule-1",
                    "type": "user",
                    "user_ids": ["user-123", "user-456"],
                    "variation_id": "var-1"  # Turn on for these users
                },
                {
                    "id": "rule-2",
                    "type": "percentage",
                    "percentage": 10,  # 10% rollout
                    "variation_id": "var-1"
                }
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),
        FeatureFlag(
            id="flag-2",
            key="discount-percentage",
            name="Discount Percentage",
            description="Configure the discount percentage for sales",
            enabled=True,
            variations=[
                FlagVariation(
                    id="var-1",
                    name="No Discount",
                    value=FlagValue(value=0, type="number")
                ),
                FlagVariation(
                    id="var-2",
                    name="Small Discount",
                    value=FlagValue(value=5, type="number")
                ),
                FlagVariation(
                    id="var-3",
                    name="Medium Discount",
                    value=FlagValue(value=10, type="number")
                ),
                FlagVariation(
                    id="var-4",
                    name="Large Discount",
                    value=FlagValue(value=20, type="number")
                )
            ],
            default_variation_id="var-1",  # Default to no discount
            rules=[
                {
                    "id": "rule-1",
                    "type": "attribute",
                    "attribute": "loyalty_tier",
                    "operator": "equals",
                    "value": "gold",
                    "variation_id": "var-4"  # Large discount for gold tier
                },
                {
                    "id": "rule-2",
                    "type": "attribute",
                    "attribute": "loyalty_tier",
                    "operator": "equals",
                    "value": "silver",
                    "variation_id": "var-3"  # Medium discount for silver tier
                }
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]
    
    for flag in sample_flags:
        flags_db[flag.key] = flag.dict()

# Define lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load sample data
    load_sample_data()
    print("Sample data loaded")
    yield
    # Shutdown: cleanup operations could go here
    print("Shutting down")

# Create FastAPI app with lifespan
app = FastAPI(title="Feature Management Platform API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Environment(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class Segment(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rules: List[Dict[str, Any]]

class FlagValue(BaseModel):
    value: Any
    type: str = "boolean"  # boolean, string, number, json

class FlagVariation(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    value: FlagValue

class FeatureFlag(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    enabled: bool = True
    variations: List[FlagVariation]
    default_variation_id: str
    rules: Optional[List[Dict[str, Any]]] = []
    created_at: str
    updated_at: str

class EvaluationContext(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    attributes: Dict[str, Any] = {}

class EvaluationResult(BaseModel):
    flag_key: str
    variation_id: str
    value: Any
    reason: str

# API Key authentication (simplified for prototype)
def get_api_key(x_api_key: str = Header(None)):
    if x_api_key is None or x_api_key != "test-api-key":  # Obviously, use proper auth in production
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

# Endpoints
@app.get("/")
def read_root():
    return {"message": "Feature Management Platform API"}

# Environment endpoints
@app.post("/api/v1/environments", response_model=Environment)
def create_environment(environment: Environment, api_key: str = Depends(get_api_key)):
    if not environment.id:
        environment.id = str(uuid.uuid4())
    environments_db[environment.id] = environment.dict()
    return environment

@app.get("/api/v1/environments", response_model=List[Environment])
def list_environments(api_key: str = Depends(get_api_key)):
    return list(environments_db.values())

# Feature flag endpoints
@app.post("/api/v1/flags", response_model=FeatureFlag)
def create_flag(flag: FeatureFlag, api_key: str = Depends(get_api_key)):
    if not flag.id:
        flag.id = str(uuid.uuid4())
    
    now = datetime.now().isoformat()
    flag.created_at = now
    flag.updated_at = now
    
    flags_db[flag.key] = flag.dict()
    return flag

@app.get("/api/v1/flags", response_model=List[FeatureFlag])
def list_flags(api_key: str = Depends(get_api_key)):
    return list(flags_db.values())

@app.get("/api/v1/flags/{flag_key}", response_model=FeatureFlag)
def get_flag(flag_key: str, api_key: str = Depends(get_api_key)):
    if flag_key not in flags_db:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flags_db[flag_key]

@app.put("/api/v1/flags/{flag_key}", response_model=FeatureFlag)
def update_flag(flag_key: str, flag: FeatureFlag, api_key: str = Depends(get_api_key)):
    if flag_key not in flags_db:
        raise HTTPException(status_code=404, detail="Flag not found")
    
    flag.updated_at = datetime.now().isoformat()
    flags_db[flag_key] = flag.dict()
    return flag

@app.delete("/api/v1/flags/{flag_key}")
def delete_flag(flag_key: str, api_key: str = Depends(get_api_key)):
    if flag_key not in flags_db:
        raise HTTPException(status_code=404, detail="Flag not found")
    
    del flags_db[flag_key]
    return {"message": f"Flag {flag_key} deleted"}

# Flag evaluation endpoint - the most important part
@app.post("/api/v1/flags/{flag_key}/evaluate", response_model=EvaluationResult)
def evaluate_flag(
    flag_key: str, 
    context: EvaluationContext, 
    environment: str = Query(None),
    api_key: str = Depends(get_api_key)
):
    # Start timing for performance measurement
    start_time = time.time()
    
    # Get the flag
    if flag_key not in flags_db:
        raise HTTPException(status_code=404, detail="Flag not found")
    
    flag = FeatureFlag(**flags_db[flag_key])
    
    # Check if flag is enabled
    if not flag.enabled:
        # Return default variation if flag is disabled
        default_variation = next((v for v in flag.variations if v.id == flag.default_variation_id), None)
        if not default_variation:
            default_variation = flag.variations[0] if flag.variations else None
        
        if not default_variation:
            raise HTTPException(status_code=500, detail="No variations available for this flag")
        
        return EvaluationResult(
            flag_key=flag_key,
            variation_id=default_variation.id,
            value=default_variation.value.value,
            reason="FLAG_DISABLED"
        )
    
    # Start with the default variation
    selected_variation = next((v for v in flag.variations if v.id == flag.default_variation_id), None)
    if not selected_variation and flag.variations:
        selected_variation = flag.variations[0]
    
    reason = "DEFAULT_RULE"
    
    # Check rule-based targeting
    if flag.rules:
        for rule in flag.rules:
            if evaluate_rule(rule, context):
                variation_id = rule.get("variation_id")
                if variation_id:
                    selected_variation = next((v for v in flag.variations if v.id == variation_id), selected_variation)
                    reason = f"RULE_MATCH:{rule.get('id', 'unknown')}"
                    break
    
    # Fallback to default if no variation was selected
    if not selected_variation:
        raise HTTPException(status_code=500, detail="Could not determine variation for flag")
    
    # Log evaluation for analytics (would go to a database in production)
    # print(f"Flag {flag_key} evaluated for user {context.user_id}: {selected_variation.value.value}")
    
    # Calculate response time
    response_time = time.time() - start_time
    # print(f"Flag evaluation took {response_time*1000:.2f}ms")
    
    return EvaluationResult(
        flag_key=flag_key,
        variation_id=selected_variation.id,
        value=selected_variation.value.value,
        reason=reason
    )

# Client SDK endpoint - for client-side evaluation
@app.get("/api/v1/client/{environment_id}")
def get_client_flags(environment_id: str):
    """
    Returns all flags for client-side usage.
    In production, you'd want to filter based on permissions and publish/subscribe to changes.
    """
    # Filter flags for client-side only, etc.
    return {"flags": list(flags_db.values())}

# Helper function to evaluate rules
def evaluate_rule(rule: Dict[str, Any], context: EvaluationContext) -> bool:
    """Simple rule evaluation logic"""
    rule_type = rule.get("type")
    
    if rule_type == "user":
        # User targeting
        user_ids = rule.get("user_ids", [])
        if context.user_id and context.user_id in user_ids:
            return True
    
    elif rule_type == "percentage":
        # Percentage rollout
        percentage = rule.get("percentage", 0)
        if context.user_id:
            # Deterministic hashing for consistent percentage rollouts
            hashed = hash(f"{context.user_id}:{rule.get('id', '')}")
            bucket = (hashed % 100) + 1  # 1-100
            if bucket <= percentage:
                return True
    
    elif rule_type == "attribute":
        # Attribute matching
        attribute = rule.get("attribute")
        operator = rule.get("operator")
        value = rule.get("value")
        
        if attribute and operator and value is not None:
            user_value = context.attributes.get(attribute)
            
            if operator == "equals" and user_value == value:
                return True
            elif operator == "contains" and value in user_value:
                return True
            elif operator == "greater_than" and user_value > value:
                return True
            elif operator == "less_than" and user_value < value:
                return True
    
    return False

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
