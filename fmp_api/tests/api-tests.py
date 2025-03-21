import pytest
from fastapi.testclient import TestClient
from fmp_api import app, flags_db, environments_db, load_sample_data

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_data():
    """Reset the in-memory database before each test"""
    flags_db.clear()
    environments_db.clear()
    load_sample_data()

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Feature Management Platform API"}

def test_list_flags():
    response = client.get("/api/v1/flags", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    flags = response.json()
    assert len(flags) == 2
    assert any(flag["key"] == "new-checkout" for flag in flags)
    assert any(flag["key"] == "discount-percentage" for flag in flags)

def test_list_flags_unauthorized():
    response = client.get("/api/v1/flags")
    assert response.status_code == 401
    assert "Invalid API key" in response.json()["detail"]

def test_get_flag():
    response = client.get("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    flag = response.json()
    assert flag["key"] == "new-checkout"
    assert flag["name"] == "New Checkout Experience"
    assert len(flag["variations"]) == 2

def test_get_flag_not_found():
    response = client.get("/api/v1/flags/non-existent", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 404
    assert "Flag not found" in response.json()["detail"]

def test_create_flag():
    new_flag = {
        "id": "flag-test",
        "key": "test-flag",
        "name": "Test Flag",
        "description": "A test flag",
        "enabled": True,
        "variations": [
            {
                "id": "var-1",
                "name": "On",
                "value": {"type": "boolean", "value": True}
            },
            {
                "id": "var-2",
                "name": "Off",
                "value": {"type": "boolean", "value": False}
            }
        ],
        "default_variation_id": "var-2",
        "rules": [],
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
    }
    
    response = client.post("/api/v1/flags", 
                          headers={"X-API-Key": "test-api-key"}, 
                          json=new_flag)
    assert response.status_code == 200
    created_flag = response.json()
    assert created_flag["key"] == "test-flag"
    assert created_flag["name"] == "Test Flag"
    
    # Verify the flag was added to the database
    response = client.get("/api/v1/flags/test-flag", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200

def test_create_flag_missing_required_field():
    # Missing id and default_variation_id
    new_flag = {
        "key": "invalid-flag",
        "name": "Invalid Flag",
        "enabled": True,
        "variations": [
            {
                "id": "var-1",
                "name": "On",
                "value": {"type": "boolean", "value": True}
            }
        ],
        "rules": []
    }
    
    response = client.post("/api/v1/flags", 
                          headers={"X-API-Key": "test-api-key"}, 
                          json=new_flag)
    assert response.status_code == 422  # Unprocessable Entity

def test_update_flag():
    # First get the existing flag
    response = client.get("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    flag = response.json()
    
    # Modify the flag
    flag["description"] = "Updated description"
    flag["enabled"] = False
    
    response = client.put(f"/api/v1/flags/new-checkout", 
                         headers={"X-API-Key": "test-api-key"}, 
                         json=flag)
    assert response.status_code == 200
    updated_flag = response.json()
    assert updated_flag["description"] == "Updated description"
    assert updated_flag["enabled"] is False

def test_update_flag_not_found():
    new_flag = {
        "id": "flag-test",
        "key": "non-existent",
        "name": "Non-existent Flag",
        "enabled": True,
        "variations": [],
        "default_variation_id": "var-1",
        "rules": [],
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
    }
    
    response = client.put("/api/v1/flags/non-existent", 
                         headers={"X-API-Key": "test-api-key"}, 
                         json=new_flag)
    assert response.status_code == 404
    assert "Flag not found" in response.json()["detail"]

def test_delete_flag():
    # First verify the flag exists
    response = client.get("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    
    # Delete the flag
    response = client.delete("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    assert response.json() == {"message": "Flag new-checkout deleted"}
    
    # Verify the flag was deleted
    response = client.get("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 404

def test_evaluate_flag():
    context = {
        "user_id": "user-123",
        "attributes": {
            "loyalty_tier": "gold"
        }
    }
    
    # Test rule-based targeting (user rule)
    response = client.post("/api/v1/flags/new-checkout/evaluate", 
                          headers={"X-API-Key": "test-api-key"}, 
                          json=context)
    assert response.status_code == 200
    result = response.json()
    assert result["flag_key"] == "new-checkout"
    assert result["value"] is True
    assert "RULE_MATCH" in result["reason"]
    
    # Test rule-based targeting (attribute rule)
    response = client.post("/api/v1/flags/discount-percentage/evaluate", 
                          headers={"X-API-Key": "test-api-key"}, 
                          json=context)
    assert response.status_code == 200
    result = response.json()
    assert result["flag_key"] == "discount-percentage"
    assert result["value"] == 20  # Large discount for gold tier
    assert "RULE_MATCH" in result["reason"]

def test_evaluate_disabled_flag():
    # First disable the flag
    response = client.get("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"})
    flag = response.json()
    flag["enabled"] = False
    client.put("/api/v1/flags/new-checkout", headers={"X-API-Key": "test-api-key"}, json=flag)
    
    context = {"user_id": "user-123"}
    response = client.post("/api/v1/flags/new-checkout/evaluate", 
                          headers={"X-API-Key": "test-api-key"}, 
                          json=context)
    assert response.status_code == 200
    result = response.json()
    assert result["flag_key"] == "new-checkout"
    assert result["reason"] == "FLAG_DISABLED"
    assert result["value"] is False  # Default variation (off)

def test_client_sdk_endpoint():
    response = client.get("/api/v1/client/prod", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "flags" in data
    assert len(data["flags"]) == 2
