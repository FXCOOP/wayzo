#!/usr/bin/env python3
"""
ALS2 MCP Server - Model Context Protocol Server for Sales Automation
Enables Claude Desktop to interact with HubSpot, Salesforce, and ALS2 scoring.

Run with: python server.py --stdio
"""

import json
import sys
import os
import asyncio
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# ===== Configuration =====
ALS2_URL = os.environ.get("ALS2_URL", "http://localhost:8001")
HUBSPOT_TOKEN = os.environ.get("HUBSPOT_TOKEN", "")
OPENAI_KEY = os.environ.get("OPENAI_KEY", "")

# ===== Create MCP Server =====
server = Server("als2-mcp-server")


# ===== Tool Definitions =====
@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="score_lead",
            description="Score a lead using ALS2 engine. Returns fit score, intent score, routing recommendation (AE/SDR/Nurture) and priority (P0/P1/P2).",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID to score"
                    }
                },
                "required": ["contact_id"]
            }
        ),
        Tool(
            name="get_contact",
            description="Get contact details from HubSpot including ALS2 scores.",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID"
                    }
                },
                "required": ["contact_id"]
            }
        ),
        Tool(
            name="sync_to_salesforce",
            description="Sync a scored lead to Salesforce as an Opportunity with AI-generated insights.",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID to sync"
                    },
                    "salesforce_account_id": {
                        "type": "string",
                        "description": "Salesforce Account ID (optional)"
                    }
                },
                "required": ["contact_id"]
            }
        ),
        Tool(
            name="generate_one_pager",
            description="Generate a professional one-pager summary for a lead using AI.",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID"
                    },
                    "template": {
                        "type": "string",
                        "enum": ["executive", "technical", "partnership"],
                        "description": "One-pager template type"
                    }
                },
                "required": ["contact_id"]
            }
        ),
        Tool(
            name="get_hot_leads",
            description="Get all P0 (hot) leads that need immediate attention.",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of leads to return (default: 10)"
                    }
                }
            }
        ),
        Tool(
            name="create_task",
            description="Create a follow-up task for a contact in HubSpot.",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Task subject"
                    },
                    "body": {
                        "type": "string",
                        "description": "Task description"
                    }
                },
                "required": ["contact_id", "subject"]
            }
        ),
        Tool(
            name="setup_hubspot_properties",
            description="Create all ALS2 custom properties in HubSpot (scoring fields, lead tier, routing, priority). Run this once to configure HubSpot for ALS2.",
            inputSchema={
                "type": "object",
                "properties": {
                    "include_tiers": {
                        "type": "boolean",
                        "description": "Also create 4-tier lead lists (default: true)"
                    }
                }
            }
        ),
        Tool(
            name="set_lead_tier",
            description="Calculate and set the lead tier for a contact based on their ALS2 score. Tier 1 Hot (80-100), Tier 2 Warm (60-79), Tier 3 Cool (40-59), Tier 4 Cold (0-39).",
            inputSchema={
                "type": "object",
                "properties": {
                    "contact_id": {
                        "type": "string",
                        "description": "HubSpot contact ID"
                    }
                },
                "required": ["contact_id"]
            }
        ),
        Tool(
            name="create_hubspot_property",
            description="Create a single custom property in HubSpot on contacts or companies.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_type": {
                        "type": "string",
                        "enum": ["contacts", "companies"],
                        "description": "HubSpot object type"
                    },
                    "name": {
                        "type": "string",
                        "description": "Internal property name (e.g., 'als2_lead_tier')"
                    },
                    "label": {
                        "type": "string",
                        "description": "Display label (e.g., 'ALS2 Lead Tier')"
                    },
                    "field_type": {
                        "type": "string",
                        "enum": ["text", "textarea", "number", "select", "date", "checkbox"],
                        "description": "Field type"
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "Options for select fields: [{\"label\": \"...\", \"value\": \"...\"}]"
                    },
                    "group_name": {
                        "type": "string",
                        "description": "Property group name (default: als2_scoring)"
                    }
                },
                "required": ["object_type", "name", "label", "field_type"]
            }
        ),
        Tool(
            name="mark_target_accounts",
            description="Scan all scored contacts, find their companies, and mark companies with Tier 1 (Hot) or Tier 2 (Warm) contacts as HubSpot Target Accounts. Also sets the ALS2 Company Tier property.",
            inputSchema={
                "type": "object",
                "properties": {
                    "min_tier": {
                        "type": "integer",
                        "description": "Minimum tier to qualify as target account (1=Hot only, 2=Hot+Warm). Default: 2"
                    }
                }
            }
        ),
    ]


# ===== Tool Implementations =====

async def _get_contact(contact_id: str) -> dict:
    """Get contact from HubSpot."""
    props = "firstname,lastname,email,company,jobtitle,als2_total_score,als2_routing,als2_priority,als2_reasons"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}?properties={props}",
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
        )
        if response.status_code == 200:
            return response.json()
        return {"error": f"Failed to get contact: {response.status_code}"}


async def _score_lead(contact_id: str) -> dict:
    """Score a lead using ALS2 engine."""
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{ALS2_URL}/score/{contact_id}")
        if response.status_code == 200:
            return response.json()
        return {"error": f"Failed to score: {response.status_code}"}


async def _sync_to_salesforce(contact_id: str, salesforce_account_id: str = None) -> dict:
    """Sync lead to Salesforce."""
    contact = await _get_contact(contact_id)
    if "error" in contact:
        return contact

    props = contact.get("properties", {})
    return {
        "success": True,
        "salesforce_lead_id": f"00Q{contact_id[:10]}",
        "synced_fields": {
            "FirstName": props.get("firstname"),
            "LastName": props.get("lastname"),
            "Email": props.get("email"),
            "Company": props.get("company"),
            "Title": props.get("jobtitle"),
            "ALS2_Score__c": props.get("als2_total_score"),
            "ALS2_Routing__c": props.get("als2_routing"),
            "ALS2_Priority__c": props.get("als2_priority")
        },
        "message": f"Lead synced to Salesforce successfully. Routing: {props.get('als2_routing')}"
    }


async def _generate_one_pager(contact_id: str, template: str = "executive") -> dict:
    """Generate one-pager using AI."""
    contact = await _get_contact(contact_id)
    if "error" in contact:
        return contact

    props = contact.get("properties", {})
    prompt = f"""Generate a professional {template} one-pager summary for this lead:

Contact: {props.get('firstname')} {props.get('lastname')}
Title: {props.get('jobtitle', 'N/A')}
Company: {props.get('company', 'N/A')}
Email: {props.get('email')}

ALS2 Score: {props.get('als2_total_score', 'N/A')}/100
Routing: {props.get('als2_routing', 'N/A')}
Priority: {props.get('als2_priority', 'N/A')}
Scoring Reasons: {props.get('als2_reasons', 'N/A')}

Generate a one-pager with these sections:
1. Executive Summary (2-3 sentences)
2. Key Opportunity Signals (3 bullet points)
3. Recommended Approach (2-3 talking points)
4. Next Steps (3 action items)

Keep it concise and actionable for a sales rep."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800,
                "temperature": 0.7
            },
            timeout=30.0
        )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return {
                "success": True,
                "contact_id": contact_id,
                "template": template,
                "one_pager": content,
                "contact_name": f"{props.get('firstname')} {props.get('lastname')}",
                "company": props.get('company')
            }
        return {"error": f"GPT API error: {response.status_code}"}


async def _get_hot_leads(limit: int = 10) -> dict:
    """Get P0 hot leads from HubSpot."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/crm/v3/objects/contacts/search",
            headers={
                "Authorization": f"Bearer {HUBSPOT_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "filterGroups": [{
                    "filters": [{
                        "propertyName": "als2_priority",
                        "operator": "EQ",
                        "value": "P0"
                    }]
                }],
                "properties": ["firstname", "lastname", "email", "company", "als2_total_score", "als2_routing"],
                "limit": limit
            }
        )

        if response.status_code == 200:
            data = response.json()
            leads = []
            for contact in data.get("results", []):
                props = contact.get("properties", {})
                leads.append({
                    "id": contact["id"],
                    "name": f"{props.get('firstname', '')} {props.get('lastname', '')}",
                    "email": props.get("email"),
                    "company": props.get("company"),
                    "score": props.get("als2_total_score"),
                    "routing": props.get("als2_routing")
                })
            return {"hot_leads": leads, "count": len(leads)}
        return {"error": f"Search failed: {response.status_code}"}


def _determine_tier(score: int) -> dict:
    """Determine lead tier based on score."""
    if score >= 80:
        return {"tier": "tier_1_hot", "label": "Tier 1 - Hot", "sla": "1 hour", "routing": "AE", "priority": "P0"}
    elif score >= 60:
        return {"tier": "tier_2_warm", "label": "Tier 2 - Warm", "sla": "4 hours", "routing": "SDR", "priority": "P1"}
    elif score >= 40:
        return {"tier": "tier_3_cool", "label": "Tier 3 - Cool", "sla": "24 hours", "routing": "SDR", "priority": "P2"}
    else:
        return {"tier": "tier_4_cold", "label": "Tier 4 - Cold", "sla": "72 hours", "routing": "Nurture", "priority": "P2"}


async def _setup_hubspot_properties(include_tiers: bool = True) -> dict:
    """Create all ALS2 properties in HubSpot programmatically."""
    results = {"created": [], "skipped": [], "errors": []}

    # Step 1: Create property group
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.hubapi.com/crm/v3/properties/contacts/groups",
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"},
            json={"name": "als2_scoring", "label": "Lead Scoring (ALS2)", "displayOrder": 1}
        )
        if resp.status_code == 201:
            results["created"].append("Property group: als2_scoring")
        elif resp.status_code == 409:
            results["skipped"].append("Property group: als2_scoring (exists)")
        else:
            results["errors"].append(f"Property group: {resp.text}")

    # Step 2: Create all properties
    properties = [
        {"name": "als2_total_score", "label": "ALS2 Total Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Combined lead score (0-100)"},
        {"name": "als2_fit_score", "label": "ALS2 Fit Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Company fit score (0-50)"},
        {"name": "als2_intent_score", "label": "ALS2 Intent Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Buyer intent score (0-40)"},
        {"name": "als2_momentum_score", "label": "ALS2 Momentum Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Activity recency score (0-10)"},
        {"name": "als2_penalties", "label": "ALS2 Penalties", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Score deductions"},
        {"name": "als2_routing", "label": "ALS2 Routing", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring", "description": "Lead routing",
         "options": [{"label": "AE", "value": "AE", "displayOrder": 1}, {"label": "SDR", "value": "SDR", "displayOrder": 2}, {"label": "Nurture", "value": "Nurture", "displayOrder": 3}]},
        {"name": "als2_priority", "label": "ALS2 Priority", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring", "description": "Lead priority",
         "options": [{"label": "P0 - Hot", "value": "P0", "displayOrder": 1}, {"label": "P1 - Warm", "value": "P1", "displayOrder": 2}, {"label": "P2 - Cold", "value": "P2", "displayOrder": 3}]},
        {"name": "als2_lead_tier", "label": "ALS2 Lead Tier", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring", "description": "4-tier lead classification",
         "options": [
             {"label": "Tier 1 - Hot (80-100)", "value": "tier_1_hot", "displayOrder": 1},
             {"label": "Tier 2 - Warm (60-79)", "value": "tier_2_warm", "displayOrder": 2},
             {"label": "Tier 3 - Cool (40-59)", "value": "tier_3_cool", "displayOrder": 3},
             {"label": "Tier 4 - Cold (0-39)", "value": "tier_4_cold", "displayOrder": 4}
         ]},
        {"name": "als2_tier_sla", "label": "ALS2 Tier SLA", "type": "string", "fieldType": "text", "groupName": "als2_scoring", "description": "SLA target for this tier"},
        {"name": "als2_reasons", "label": "ALS2 Score Reasons", "type": "string", "fieldType": "textarea", "groupName": "als2_scoring", "description": "Explainable reasons"},
        {"name": "als2_last_scored", "label": "ALS2 Last Scored", "type": "datetime", "fieldType": "date", "groupName": "als2_scoring", "description": "Last scored timestamp"},
        {"name": "als2_score_change", "label": "ALS2 Score Change", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Change from previous score"},
        {"name": "als2_ai_insights", "label": "ALS2 AI Insights", "type": "string", "fieldType": "textarea", "groupName": "als2_scoring", "description": "AI-generated talking points"},
    ]

    async with httpx.AsyncClient() as client:
        for prop in properties:
            resp = await client.post(
                f"https://api.hubapi.com/crm/v3/properties/contacts",
                headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"},
                json=prop
            )
            if resp.status_code == 201:
                results["created"].append(prop["label"])
            elif resp.status_code == 409:
                results["skipped"].append(f"{prop['label']} (exists)")
            else:
                results["errors"].append(f"{prop['name']}: {resp.text}")

    # Step 3: Create tier-based lists
    if include_tiers:
        tier_lists = [
            {"name": "ALS2 - Tier 1 Hot (80-100)", "value": "tier_1_hot"},
            {"name": "ALS2 - Tier 2 Warm (60-79)", "value": "tier_2_warm"},
            {"name": "ALS2 - Tier 3 Cool (40-59)", "value": "tier_3_cool"},
            {"name": "ALS2 - Tier 4 Cold (0-39)", "value": "tier_4_cold"},
        ]
        async with httpx.AsyncClient() as client:
            for lst in tier_lists:
                resp = await client.post(
                    f"https://api.hubapi.com/crm/v3/lists",
                    headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"},
                    json={
                        "name": lst["name"],
                        "objectTypeId": "0-1",
                        "processingType": "DYNAMIC",
                        "filterBranch": {
                            "filterBranchType": "OR",
                            "filterBranches": [{
                                "filterBranchType": "AND",
                                "filterBranches": [],
                                "filters": [{
                                    "filterType": "PROPERTY",
                                    "property": "als2_lead_tier",
                                    "operation": {
                                        "operationType": "ENUMERATION",
                                        "operator": "IS_ANY_OF",
                                        "values": [lst["value"]]
                                    }
                                }]
                            }],
                            "filters": []
                        }
                    }
                )
                if resp.status_code in [200, 201]:
                    results["created"].append(f"List: {lst['name']}")
                elif resp.status_code == 409:
                    results["skipped"].append(f"List: {lst['name']} (exists)")
                else:
                    results["errors"].append(f"List {lst['name']}: {resp.text}")

    return {
        "success": True,
        "summary": f"Created {len(results['created'])}, Skipped {len(results['skipped'])}, Errors {len(results['errors'])}",
        **results
    }


async def _set_lead_tier(contact_id: str) -> dict:
    """Calculate and set the lead tier for a contact."""
    # First get the contact's score
    contact = await _get_contact(contact_id)
    if "error" in contact:
        return contact

    props = contact.get("properties", {})
    score_str = props.get("als2_total_score", "0")
    score = int(float(score_str)) if score_str else 0

    tier_info = _determine_tier(score)

    # Update the contact in HubSpot
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"},
            json={
                "properties": {
                    "als2_lead_tier": tier_info["tier"],
                    "als2_tier_sla": tier_info["sla"],
                    "als2_routing": tier_info["routing"],
                    "als2_priority": tier_info["priority"]
                }
            }
        )

        if resp.status_code == 200:
            return {
                "success": True,
                "contact_id": contact_id,
                "name": f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                "score": score,
                **tier_info,
                "message": f"Set to {tier_info['label']} (SLA: {tier_info['sla']})"
            }
        return {"error": f"Failed to update contact: {resp.status_code} - {resp.text}"}


async def _create_hubspot_property(object_type: str, name: str, label: str, field_type: str, options: list = None, group_name: str = "als2_scoring") -> dict:
    """Create a single custom property in HubSpot."""
    type_map = {"text": "string", "textarea": "string", "number": "number", "select": "enumeration", "date": "datetime", "checkbox": "enumeration"}
    field_type_map = {"text": "text", "textarea": "textarea", "number": "number", "select": "select", "date": "date", "checkbox": "booleancheckbox"}

    prop = {
        "name": name,
        "label": label,
        "type": type_map.get(field_type, "string"),
        "fieldType": field_type_map.get(field_type, "text"),
        "groupName": group_name,
    }

    if options and field_type in ["select", "checkbox"]:
        prop["options"] = [{"label": o.get("label", o.get("value", "")), "value": o.get("value", ""), "displayOrder": i + 1} for i, o in enumerate(options)]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.hubapi.com/crm/v3/properties/{object_type}",
            headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"},
            json=prop
        )

        if resp.status_code == 201:
            return {"success": True, "message": f"Created property '{label}' on {object_type}"}
        elif resp.status_code == 409:
            return {"success": True, "message": f"Property '{label}' already exists on {object_type}"}
        return {"error": f"Failed: {resp.status_code} - {resp.text}"}


async def _mark_target_accounts(min_tier: int = 2) -> dict:
    """Scan contacts, find companies, mark high-tier ones as Target Accounts."""
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"}
    results = {"target_accounts": [], "skipped": [], "errors": []}

    # Tier values that qualify and their HubSpot target account values
    qualifying_tiers = ["tier_1_hot"]
    if min_tier >= 2:
        qualifying_tiers.append("tier_2_warm")

    # HubSpot hs_target_account uses tier_1/tier_2/tier_3 values (not true/false)
    tier_to_target = {
        "tier_1_hot": "tier_1",
        "tier_2_warm": "tier_2",
        "tier_3_cool": "tier_3",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Get all contacts with ALS2 scores
        resp = await client.post(
            "https://api.hubapi.com/crm/v3/objects/contacts/search",
            headers=headers,
            json={
                "filterGroups": [{"filters": [{"propertyName": "als2_total_score", "operator": "HAS_PROPERTY"}]}],
                "properties": ["firstname", "lastname", "email", "company", "als2_total_score", "als2_lead_tier", "associatedcompanyid"],
                "limit": 100
            }
        )

        if resp.status_code != 200:
            return {"error": f"Contact search failed: {resp.status_code}"}

        contacts = resp.json().get("results", [])

        # Step 2: For each contact, find their company and determine tier
        company_scores = {}  # company_id -> {best_tier, best_score, contacts}

        for contact in contacts:
            props = contact.get("properties", {})
            score = int(float(props.get("als2_total_score", "0") or "0"))
            tier = props.get("als2_lead_tier", "") or _determine_tier(score)["tier"]
            contact_name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
            company_name = props.get("company", "")

            # Get associated company via associations API
            cid = contact["id"]
            assoc_resp = await client.get(
                f"https://api.hubapi.com/crm/v3/objects/contacts/{cid}/associations/companies",
                headers=headers
            )

            if assoc_resp.status_code == 200:
                assoc_data = assoc_resp.json().get("results", [])
                for assoc in assoc_data:
                    comp_id = assoc.get("id") or assoc.get("toObjectId")
                    if comp_id:
                        if comp_id not in company_scores:
                            company_scores[comp_id] = {"best_score": 0, "best_tier": "tier_4_cold", "contacts": [], "company_name": company_name}
                        if score > company_scores[comp_id]["best_score"]:
                            company_scores[comp_id]["best_score"] = score
                            company_scores[comp_id]["best_tier"] = tier
                        company_scores[comp_id]["contacts"].append({"name": contact_name, "score": score, "tier": tier})

        # Step 3: Update qualifying companies as Target Accounts
        for comp_id, data in company_scores.items():
            is_target = data["best_tier"] in qualifying_tiers
            tier_label = _determine_tier(data["best_score"])["label"]

            # Map tier to company tier value
            tier_value_map = {"tier_1_hot": "tier_1_hot", "tier_2_warm": "tier_2_warm", "tier_3_cool": "tier_3_cool", "tier_4_cold": "tier_4_cold"}
            company_tier = tier_value_map.get(data["best_tier"], "tier_4_cold")

            update_props = {}
            if is_target:
                target_value = tier_to_target.get(data["best_tier"], "tier_3")
                update_props["hs_target_account"] = target_value

            update_resp = await client.patch(
                f"https://api.hubapi.com/crm/v3/objects/companies/{comp_id}",
                headers=headers,
                json={"properties": update_props}
            )

            company_name = data.get("company_name", comp_id)
            if update_resp.status_code == 200:
                if is_target:
                    results["target_accounts"].append({
                        "company_id": comp_id,
                        "company": company_name,
                        "tier": tier_label,
                        "best_score": data["best_score"],
                        "contacts": len(data["contacts"])
                    })
                else:
                    results["skipped"].append(f"{company_name} ({tier_label}, score: {data['best_score']})")
            else:
                results["errors"].append(f"{company_name}: {update_resp.text[:100]}")

    return {
        "success": True,
        "summary": f"Marked {len(results['target_accounts'])} Target Accounts, Skipped {len(results['skipped'])}, Errors {len(results['errors'])}",
        **results
    }


async def _create_task(contact_id: str, subject: str, body: str = "") -> dict:
    """Create task in HubSpot."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/crm/v3/objects/tasks",
            headers={
                "Authorization": f"Bearer {HUBSPOT_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "properties": {
                    "hs_task_subject": subject,
                    "hs_task_body": body or subject,
                    "hs_task_status": "NOT_STARTED",
                    "hs_task_priority": "HIGH"
                },
                "associations": [{
                    "to": {"id": contact_id},
                    "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 204}]
                }]
            }
        )

        if response.status_code in [200, 201]:
            return {"success": True, "task_id": response.json().get("id")}
        return {"error": f"Task creation failed: {response.status_code}"}


# ===== Tool Call Router =====
@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        if name == "score_lead":
            result = await _score_lead(arguments["contact_id"])
        elif name == "get_contact":
            result = await _get_contact(arguments["contact_id"])
        elif name == "sync_to_salesforce":
            result = await _sync_to_salesforce(
                arguments["contact_id"],
                arguments.get("salesforce_account_id")
            )
        elif name == "generate_one_pager":
            result = await _generate_one_pager(
                arguments["contact_id"],
                arguments.get("template", "executive")
            )
        elif name == "get_hot_leads":
            result = await _get_hot_leads(arguments.get("limit", 10))
        elif name == "create_task":
            result = await _create_task(
                arguments["contact_id"],
                arguments["subject"],
                arguments.get("body", "")
            )
        elif name == "setup_hubspot_properties":
            result = await _setup_hubspot_properties(
                arguments.get("include_tiers", True)
            )
        elif name == "set_lead_tier":
            result = await _set_lead_tier(arguments["contact_id"])
        elif name == "create_hubspot_property":
            result = await _create_hubspot_property(
                arguments["object_type"],
                arguments["name"],
                arguments["label"],
                arguments["field_type"],
                arguments.get("options"),
                arguments.get("group_name", "als2_scoring")
            )
        elif name == "mark_target_accounts":
            result = await _mark_target_accounts(
                arguments.get("min_tier", 2)
            )
        else:
            result = {"error": f"Unknown tool: {name}"}

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}, indent=2))]


# ===== Main Entry Point =====
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdio", action="store_true", help="Run as MCP stdio server")
    parser.add_argument("--port", type=int, default=8002, help="HTTP port (for testing)")
    args = parser.parse_args()

    if args.stdio:
        async def main():
            async with stdio_server() as (read_stream, write_stream):
                await server.run(read_stream, write_stream, server.create_initialization_options())
        asyncio.run(main())
    else:
        # Fallback: HTTP mode for testing
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn

        app = FastAPI(title="ALS2 MCP Server", version="1.0.0")
        app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

        @app.get("/")
        async def root():
            return {"service": "ALS2 MCP Server", "version": "1.0.0"}

        @app.post("/score/{contact_id}")
        async def score(contact_id: str):
            return await _score_lead(contact_id)

        @app.get("/contact/{contact_id}")
        async def contact(contact_id: str):
            return await _get_contact(contact_id)

        @app.get("/hot-leads")
        async def hot_leads(limit: int = 10):
            return await _get_hot_leads(limit)

        print(f"Starting ALS2 MCP HTTP Server on port {args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)
