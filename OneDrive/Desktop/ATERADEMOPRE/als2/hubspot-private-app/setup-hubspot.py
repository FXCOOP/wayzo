#!/usr/bin/env python3
"""
ALS2 HubSpot Setup Script
=========================
Automatically configures HubSpot with required properties and workflows.

Usage:
    export HUBSPOT_ACCESS_TOKEN="your-hubspot-token-here"
    python setup-hubspot.py
"""

import os
import httpx
import json
import sys

HUBSPOT_TOKEN = os.environ.get("HUBSPOT_ACCESS_TOKEN", "")
HUBSPOT_API = "https://api.hubapi.com"

def headers():
    return {
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
        "Content-Type": "application/json"
    }

def create_property_group():
    """Create the ALS2 property group."""
    print("[1] Creating property group...")

    response = httpx.post(
        f"{HUBSPOT_API}/crm/v3/properties/contacts/groups",
        headers=headers(),
        json={
            "name": "als2_scoring",
            "label": "Lead Scoring (ALS2)",
            "displayOrder": 1
        }
    )

    if response.status_code == 201:
        print("   [OK] Property group created")
    elif response.status_code == 409:
        print("   [SKIP] Property group already exists")
    else:
        print(f"   [X] Error: {response.text}")

def create_properties():
    """Create all ALS2 contact properties."""
    print("[2] Creating contact properties...")

    properties = [
        {
            "name": "als2_total_score",
            "label": "ALS2 Total Score",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Combined lead score (0-100)"
        },
        {
            "name": "als2_fit_score",
            "label": "ALS2 Fit Score",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Company fit score (0-50)"
        },
        {
            "name": "als2_intent_score",
            "label": "ALS2 Intent Score",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Buyer intent score (0-40)"
        },
        {
            "name": "als2_momentum_score",
            "label": "ALS2 Momentum Score",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Activity recency score (0-10)"
        },
        {
            "name": "als2_penalties",
            "label": "ALS2 Penalties",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Score deductions for missing data"
        },
        {
            "name": "als2_routing",
            "label": "ALS2 Routing",
            "type": "enumeration",
            "fieldType": "select",
            "groupName": "als2_scoring",
            "description": "Recommended lead routing",
            "options": [
                {"label": "AE", "value": "AE", "displayOrder": 1},
                {"label": "SDR", "value": "SDR", "displayOrder": 2},
                {"label": "Nurture", "value": "Nurture", "displayOrder": 3}
            ]
        },
        {
            "name": "als2_priority",
            "label": "ALS2 Priority",
            "type": "enumeration",
            "fieldType": "select",
            "groupName": "als2_scoring",
            "description": "Lead priority level",
            "options": [
                {"label": "P0 - Hot", "value": "P0", "displayOrder": 1},
                {"label": "P1 - Warm", "value": "P1", "displayOrder": 2},
                {"label": "P2 - Cold", "value": "P2", "displayOrder": 3}
            ]
        },
        {
            "name": "als2_reasons",
            "label": "ALS2 Score Reasons",
            "type": "string",
            "fieldType": "textarea",
            "groupName": "als2_scoring",
            "description": "Explainable reasons for the score"
        },
        {
            "name": "als2_last_scored",
            "label": "ALS2 Last Scored",
            "type": "datetime",
            "fieldType": "date",
            "groupName": "als2_scoring",
            "description": "When the lead was last scored"
        },
        {
            "name": "als2_score_change",
            "label": "ALS2 Score Change",
            "type": "number",
            "fieldType": "number",
            "groupName": "als2_scoring",
            "description": "Change from previous score"
        },
        {
            "name": "als2_ai_insights",
            "label": "ALS2 AI Insights",
            "type": "string",
            "fieldType": "textarea",
            "groupName": "als2_scoring",
            "description": "AI-generated talking points"
        },
        {
            "name": "als2_lead_tier",
            "label": "ALS2 Lead Tier",
            "type": "enumeration",
            "fieldType": "select",
            "groupName": "als2_scoring",
            "description": "4-tier lead classification based on ALS2 score",
            "options": [
                {"label": "Tier 1 - Hot (80-100)", "value": "tier_1_hot", "displayOrder": 1},
                {"label": "Tier 2 - Warm (60-79)", "value": "tier_2_warm", "displayOrder": 2},
                {"label": "Tier 3 - Cool (40-59)", "value": "tier_3_cool", "displayOrder": 3},
                {"label": "Tier 4 - Cold (0-39)", "value": "tier_4_cold", "displayOrder": 4}
            ]
        },
        {
            "name": "als2_tier_sla",
            "label": "ALS2 Tier SLA",
            "type": "string",
            "fieldType": "text",
            "groupName": "als2_scoring",
            "description": "SLA target for this lead tier (e.g., 1h, 4h, 24h, 72h)"
        }
    ]

    for prop in properties:
        response = httpx.post(
            f"{HUBSPOT_API}/crm/v3/properties/contacts",
            headers=headers(),
            json=prop
        )

        if response.status_code == 201:
            print(f"   [OK] Created: {prop['label']}")
        elif response.status_code == 409:
            print(f"   [SKIP] Exists: {prop['label']}")
        else:
            print(f"   [X] Error creating {prop['name']}: {response.text}")

def create_company_property():
    """Create ABM target property on companies."""
    print("[3] Creating company properties...")

    response = httpx.post(
        f"{HUBSPOT_API}/crm/v3/properties/companies",
        headers=headers(),
        json={
            "name": "is_abm_target",
            "label": "Is ABM Target",
            "type": "enumeration",
            "fieldType": "booleancheckbox",
            "groupName": "companyinformation",
            "description": "Mark as ABM target account for higher scoring",
            "options": [
                {"label": "Yes", "value": "true", "displayOrder": 1},
                {"label": "No", "value": "false", "displayOrder": 2}
            ]
        }
    )

    if response.status_code == 201:
        print("   [OK] Created: Is ABM Target")
    elif response.status_code == 409:
        print("   [SKIP] Exists: Is ABM Target")
    else:
        print(f"   [X] Error: {response.text}")

def create_active_list():
    """Create lists for routing."""
    print("[4] Creating contact lists...")

    lists = [
        {"name": "ALS2 - Tier 1 Hot (80-100)", "filters": [{"propertyName": "als2_lead_tier", "operator": "EQ", "value": "tier_1_hot"}]},
        {"name": "ALS2 - Tier 2 Warm (60-79)", "filters": [{"propertyName": "als2_lead_tier", "operator": "EQ", "value": "tier_2_warm"}]},
        {"name": "ALS2 - Tier 3 Cool (40-59)", "filters": [{"propertyName": "als2_lead_tier", "operator": "EQ", "value": "tier_3_cool"}]},
        {"name": "ALS2 - Tier 4 Cold (0-39)", "filters": [{"propertyName": "als2_lead_tier", "operator": "EQ", "value": "tier_4_cold"}]},
        {"name": "ALS2 - Hot Leads (P0)", "filters": [{"propertyName": "als2_priority", "operator": "EQ", "value": "P0"}]},
        {"name": "ALS2 - Warm Leads (P1)", "filters": [{"propertyName": "als2_priority", "operator": "EQ", "value": "P1"}]},
        {"name": "ALS2 - Nurture Pool (P2)", "filters": [{"propertyName": "als2_priority", "operator": "EQ", "value": "P2"}]}
    ]

    for lst in lists:
        response = httpx.post(
            f"{HUBSPOT_API}/crm/v3/lists",
            headers=headers(),
            json={
                "name": lst["name"],
                "objectTypeId": "0-1",  # Contacts
                "processingType": "DYNAMIC",
                "filterBranch": {
                    "filterBranchType": "AND",
                    "filters": [{
                        "filterType": "PROPERTY",
                        "property": lst["filters"][0]["propertyName"],
                        "operation": {
                            "operationType": "STRING",
                            "operator": "IS_EQUAL_TO",
                            "value": lst["filters"][0]["value"]
                        }
                    }]
                }
            }
        )

        if response.status_code in [200, 201]:
            print(f"   [OK] Created: {lst['name']}")
        elif response.status_code == 409:
            print(f"   [SKIP] Exists: {lst['name']}")
        else:
            print(f"   [X] Error: {response.text}")

def verify_setup():
    """Verify all properties exist."""
    print("\n[5] Verifying setup...")

    response = httpx.get(
        f"{HUBSPOT_API}/crm/v3/properties/contacts",
        headers=headers(),
        params={"archived": False}
    )

    if response.status_code != 200:
        print(f"   [X] Could not verify: {response.text}")
        return

    properties = response.json().get("results", [])
    als2_props = [p for p in properties if p["name"].startswith("als2_")]

    print(f"   Found {len(als2_props)} ALS2 properties:")
    for prop in als2_props:
        print(f"      - {prop['label']} ({prop['name']})")

def main():
    print("=" * 60)
    print("[*] ALS2 HubSpot Setup")
    print("=" * 60)
    print()

    if not HUBSPOT_TOKEN:
        print("[X] Error: HUBSPOT_ACCESS_TOKEN not set")
        print()
        print("Set it with:")
        print("  export HUBSPOT_ACCESS_TOKEN='pat-na1-...'")
        sys.exit(1)

    # Test connection
    print("[~] Testing HubSpot connection...")
    response = httpx.get(
        f"{HUBSPOT_API}/crm/v3/objects/contacts",
        headers=headers(),
        params={"limit": 1}
    )

    if response.status_code != 200:
        print(f"   [X] Connection failed: {response.status_code}")
        print(f"   {response.text}")
        sys.exit(1)

    print("   [OK] Connected to HubSpot")
    print()

    # Run setup
    create_property_group()
    print()
    create_properties()
    print()
    create_company_property()
    print()
    create_active_list()
    print()
    verify_setup()

    print()
    print("=" * 60)
    print("[OK] Setup complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Start the ALS2 server:")
    print("     uvicorn server:app --port 8001")
    print()
    print("  2. Configure webhooks in HubSpot:")
    print("     Settings -> Integrations -> Webhooks")
    print("     URL: https://your-server.com/webhook/contact-created")
    print()
    print("  3. Test with a contact:")
    print("     curl -X POST http://localhost:8001/score/CONTACT_ID")
    print()

if __name__ == "__main__":
    main()
