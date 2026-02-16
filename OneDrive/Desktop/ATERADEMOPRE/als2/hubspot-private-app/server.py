"""
ALS2 HubSpot Private App + MCP Server
======================================
Full-featured lead scoring with AI intelligence.

Architecture:
  HubSpot Webhook → This Server → Score + AI Enrich → Update HubSpot

Features:
  - Real-time webhook scoring
  - Claude/OpenAI integration for smart insights
  - Automatic contact updates via Private App
  - MCP-compatible for Claude Desktop integration
"""

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx
import os
import json
import hashlib
import hmac

app = FastAPI(
    title="ALS2 HubSpot Private App",
    description="Lead Scoring Engine with HubSpot Integration + AI",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# CONFIGURATION
# =============================================================================

# HubSpot Private App credentials
HUBSPOT_ACCESS_TOKEN = os.environ.get("HUBSPOT_ACCESS_TOKEN", "")
HUBSPOT_WEBHOOK_SECRET = os.environ.get("HUBSPOT_WEBHOOK_SECRET", "")
HUBSPOT_API = "https://api.hubapi.com"

# AI Integration (optional - for smart insights)
# Paste your API key here:
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = ""  # אופציונלי - אם אין OpenAI

# Make.com Webhook (paste your Make.com webhook URL here)
MAKE_WEBHOOK_URL = os.environ.get("MAKE_WEBHOOK_URL", "")  # Set this after creating scenario

# Scoring configuration
SCORING_CONFIG = {
    "free_email_domains": [
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
        "aol.com", "icloud.com", "mail.com", "protonmail.com"
    ],
    "high_value_industries": [
        "technology", "it services", "managed services", "msp",
        "software", "saas", "cybersecurity", "fintech"
    ],
    "form_scores": {
        "demo": 35, "pricing": 30, "trial": 28, "contact": 15, "default": 5
    }
}

# =============================================================================
# HUBSPOT API CLIENT
# =============================================================================

class HubSpotClient:
    """HubSpot API wrapper for Private App."""

    def __init__(self, access_token: str):
        self.token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    async def get_contact(self, contact_id: str) -> dict:
        """Fetch contact with all properties."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{HUBSPOT_API}/crm/v3/objects/contacts/{contact_id}",
                headers=self.headers,
                params={
                    "properties": ",".join([
                        "email", "firstname", "lastname", "phone", "jobtitle",
                        "company", "hs_lead_status", "lifecyclestage",
                        "als2_total_score", "als2_fit_score", "als2_intent_score",
                        "als2_momentum_score", "als2_routing", "als2_priority",
                        "als2_reasons",
                        "notes_last_updated", "hs_latest_source_data_1"
                    ]),
                    "associations": "companies"
                }
            )
            response.raise_for_status()
            return response.json()

    async def search_by_email(self, email: str) -> dict:
        """Search for a contact by email address."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{HUBSPOT_API}/crm/v3/objects/contacts/search",
                headers=self.headers,
                json={
                    "filterGroups": [{
                        "filters": [{
                            "propertyName": "email",
                            "operator": "EQ",
                            "value": email
                        }]
                    }],
                    "properties": [
                        "email", "firstname", "lastname", "phone", "jobtitle",
                        "company", "hs_lead_status", "lifecyclestage",
                        "als2_total_score", "als2_fit_score", "als2_intent_score",
                        "als2_momentum_score", "als2_routing", "als2_priority",
                        "als2_reasons",
                        "notes_last_updated", "hs_latest_source_data_1"
                    ]
                }
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if results:
                return results[0]
            return None

    async def get_company(self, company_id: str) -> dict:
        """Fetch associated company."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{HUBSPOT_API}/crm/v3/objects/companies/{company_id}",
                headers=self.headers,
                params={
                    "properties": "name,industry,numberofemployees,annualrevenue,is_abm_target"
                }
            )
            response.raise_for_status()
            return response.json()

    async def update_contact(self, contact_id: str, properties: dict) -> dict:
        """Update contact with new scores."""
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{HUBSPOT_API}/crm/v3/objects/contacts/{contact_id}",
                headers=self.headers,
                json={"properties": properties}
            )
            if response.status_code >= 400:
                print(f"[ERROR] HubSpot update failed: {response.status_code} - {response.text}")
            response.raise_for_status()
            return response.json()

    async def create_task(self, contact_id: str, subject: str, body: str, owner_id: str = None) -> dict:
        """Create a task for follow-up. (Requires crm.objects.tasks.write scope)"""
        try:
            task_data = {
                "properties": {
                    "hs_task_subject": subject,
                    "hs_task_body": body,
                    "hs_task_status": "NOT_STARTED",
                    "hs_task_priority": "HIGH",
                    "hs_timestamp": datetime.now().isoformat()
                },
                "associations": [{
                    "to": {"id": contact_id},
                    "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 204}]
                }]
            }
            if owner_id:
                task_data["properties"]["hubspot_owner_id"] = owner_id

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{HUBSPOT_API}/crm/v3/objects/tasks",
                    headers=self.headers,
                    json=task_data
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"[SKIP] Task creation skipped (scope not available): {e}")
            return None

    async def add_timeline_event(self, contact_id: str, event_type: str, text: str) -> dict:
        """Add a note to contact timeline. (Requires crm.objects.notes.write scope)"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{HUBSPOT_API}/crm/v3/objects/notes",
                    headers=self.headers,
                    json={
                        "properties": {
                            "hs_note_body": f"[ALS2 {event_type}] {text}",
                            "hs_timestamp": datetime.now().isoformat()
                        },
                        "associations": [{
                            "to": {"id": contact_id},
                            "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 202}]
                        }]
                    }
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"[SKIP] Timeline note skipped (scope not available): {e}")
            return None

hubspot = HubSpotClient(HUBSPOT_ACCESS_TOKEN)

# =============================================================================
# AI INTELLIGENCE (Claude/OpenAI)
# =============================================================================

class AIIntelligence:
    """AI-powered lead insights using OpenAI GPT-4o-mini or Claude."""

    @staticmethod
    async def _call_openai(prompt: str, max_tokens: int = 2000) -> str:
        """Call OpenAI API with GPT-5-nano (reasoning model)."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-5-nano-2025-08-07",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_completion_tokens": max_tokens
                },
                timeout=30.0
            )
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"] or "No content generated"
            error_body = response.text[:200]
            return f"OpenAI error: {response.status_code} - {error_body}"

    @staticmethod
    async def _call_anthropic(prompt: str, max_tokens: int = 300) -> str:
        """Call Anthropic API with Claude."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                return data["content"][0]["text"]
            return f"Claude error: {response.status_code}"

    @staticmethod
    async def generate_insights(contact: dict, company: dict, score: dict) -> str:
        """Generate smart insights about the lead."""

        # Check which API is available (prefer OpenAI)
        if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
            return "AI insights disabled (no API key configured)"

        prompt = f"""Analyze this lead and provide 3 bullet points of actionable insights for a sales rep:

Contact: {contact.get('properties', {}).get('firstname')} {contact.get('properties', {}).get('lastname')}
Title: {contact.get('properties', {}).get('jobtitle', 'Unknown')}
Email: {contact.get('properties', {}).get('email')}

Company: {company.get('properties', {}).get('name', 'Unknown') if company else 'Unknown'}
Industry: {company.get('properties', {}).get('industry', 'Unknown') if company else 'Unknown'}
Size: {company.get('properties', {}).get('numberofemployees', 'Unknown') if company else 'Unknown'} employees

Lead Score: {score['total_score']}/100
Routing: {score['routing']} ({score['priority']})
Top Reasons: {', '.join(score['reasons'][:3]) if score['reasons'] else 'N/A'}

Provide:
1. One specific pain point this persona likely has
2. One talking point based on their industry
3. One suggested next action

Keep each bullet under 20 words."""

        try:
            if OPENAI_API_KEY:
                return await AIIntelligence._call_openai(prompt, 300)
            else:
                return await AIIntelligence._call_anthropic(prompt, 300)
        except Exception as e:
            return f"AI error: {str(e)}"

    @staticmethod
    async def generate_outreach(contact: dict, score: dict) -> str:
        """Generate personalized outreach message."""

        if not OPENAI_API_KEY and not ANTHROPIC_API_KEY:
            return ""

        firstname = contact.get('properties', {}).get('firstname', 'there')
        company = contact.get('properties', {}).get('company', 'your company')
        title = contact.get('properties', {}).get('jobtitle', '')

        prompt = f"""Write a 2-sentence personalized email opening for a sales email.

Recipient: {firstname}
Company: {company}
Title: {title}
They requested: a product demo
Score: {score['total_score']}/100 (high intent)

Be conversational, not salesy. Reference their role if relevant."""

        try:
            if OPENAI_API_KEY:
                return await AIIntelligence._call_openai(prompt, 150)
            else:
                return await AIIntelligence._call_anthropic(prompt, 150)
        except Exception as e:
            return ""

ai = AIIntelligence()

# =============================================================================
# SCORING ENGINE
# =============================================================================

def calculate_score(contact: dict, company: dict) -> dict:
    """Calculate lead score from contact and company data."""

    props = contact.get("properties", {})
    comp_props = company.get("properties", {}) if company else {}

    email = props.get("email", "")
    phone = props.get("phone", "")
    job_title = (props.get("jobtitle") or "").lower()
    form_name = (props.get("hs_latest_source_data_1") or "").lower()
    last_activity = props.get("notes_last_updated") or datetime.now().isoformat()
    previous_score = int(props.get("als2_total_score") or 0)

    company_size = int(comp_props.get("numberofemployees") or 0)
    industry = (comp_props.get("industry") or "").lower()
    is_abm = comp_props.get("is_abm_target") == "true"

    fit_score = 0
    intent_score = 0
    momentum_score = 0
    penalties = 0
    reasons = []

    # --- FIT SCORE (0-50) ---
    if company_size >= 500:
        fit_score += 20
        reasons.append(f"✓ Enterprise ({company_size}+ emp) → +20")
    elif company_size >= 100:
        fit_score += 15
        reasons.append(f"✓ Mid-market ({company_size} emp) → +15")
    elif company_size >= 20:
        fit_score += 10
        reasons.append(f"✓ SMB ({company_size} emp) → +10")
    elif company_size > 0:
        fit_score += 5
        reasons.append(f"○ Small ({company_size} emp) → +5")

    if is_abm:
        fit_score += 15
        reasons.append("✓ ABM target → +15")

    if any(ind in industry for ind in SCORING_CONFIG["high_value_industries"]):
        fit_score += 10
        reasons.append(f"✓ High-value industry → +10")

    if any(t in job_title for t in ["cto", "cio", "vp", "director", "head of"]):
        fit_score += 5
        reasons.append("✓ Decision-maker → +5")
    elif any(t in job_title for t in ["manager", "lead", "senior"]):
        fit_score += 3
        reasons.append("○ Influencer → +3")

    fit_score = min(fit_score, 50)

    # --- INTENT SCORE (0-40) ---
    if "demo" in form_name:
        intent_score = 35
        reasons.append("✓ Demo request → +35")
    elif "pricing" in form_name:
        intent_score = 30
        reasons.append("✓ Pricing inquiry → +30")
    elif "trial" in form_name:
        intent_score = 28
        reasons.append("✓ Trial signup → +28")
    elif "contact" in form_name:
        intent_score = 15
        reasons.append("○ Contact form → +15")
    else:
        intent_score = 5
        reasons.append("○ General inquiry → +5")

    intent_score = min(intent_score, 40)

    # --- MOMENTUM (0-10) ---
    try:
        last_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        days_ago = (datetime.now(last_dt.tzinfo) - last_dt).days
    except:
        days_ago = 0

    if days_ago <= 1:
        momentum_score = 10
        reasons.append("✓ Active today → +10")
    elif days_ago <= 7:
        momentum_score = 7
        reasons.append(f"✓ Active {days_ago}d ago → +7")
    elif days_ago <= 30:
        momentum_score = 4
        reasons.append(f"○ Last active {days_ago}d ago → +4")
    else:
        momentum_score = 1
        reasons.append(f"△ Inactive {days_ago}d → +1")

    # --- PENALTIES ---
    email_domain = email.split("@")[1] if "@" in email else ""
    if email_domain.lower() in SCORING_CONFIG["free_email_domains"]:
        penalties -= 15
        reasons.append(f"✗ Free email ({email_domain}) → -15")

    if not phone or len(phone) < 7:
        penalties -= 5
        reasons.append("✗ Missing phone → -5")

    # --- TOTAL ---
    total_score = max(0, min(100, fit_score + intent_score + momentum_score + penalties))

    if total_score >= 80:
        routing, priority = "AE", "P0"
    elif total_score >= 60:
        routing, priority = "SDR", "P1"
    else:
        routing, priority = "Nurture", "P2"

    return {
        "fit_score": fit_score,
        "intent_score": intent_score,
        "momentum_score": momentum_score,
        "penalties": penalties,
        "total_score": total_score,
        "routing": routing,
        "priority": priority,
        "reasons": reasons[:6],
        "score_change": total_score - previous_score
    }

# =============================================================================
# WEBHOOK ENDPOINTS
# =============================================================================

def verify_webhook_signature(request_body: bytes, signature: str) -> bool:
    """Verify HubSpot webhook signature."""
    if not HUBSPOT_WEBHOOK_SECRET:
        return True  # Skip verification in dev

    expected = hmac.new(
        HUBSPOT_WEBHOOK_SECRET.encode(),
        request_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected}", signature)

@app.post("/webhook/contact-created")
async def handle_contact_created(request: Request, background_tasks: BackgroundTasks):
    """Handle new contact webhook from HubSpot."""

    body = await request.body()
    signature = request.headers.get("X-HubSpot-Signature-v3", "")

    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()

    # Log incoming webhook for debugging
    print(f"[WEBHOOK] Received data type: {type(data)}, data: {str(data)[:200]}")

    # Handle different HubSpot webhook formats
    events = []
    if isinstance(data, list):
        events = data
    elif isinstance(data, dict):
        # Single event or wrapped format
        if "objectId" in data:
            events = [data]
        elif "results" in data:
            events = data.get("results", [])
        else:
            events = [data]

    # Process each event
    for event in events:
        if isinstance(event, dict):
            subscription_type = event.get("subscriptionType", "")
            object_id = event.get("objectId")

            if subscription_type == "contact.creation" and object_id:
                contact_id = str(object_id)
                print(f"[WEBHOOK] Processing contact creation: {contact_id}")
                background_tasks.add_task(process_contact, contact_id)
            elif object_id:
                # Score any contact with an objectId
                contact_id = str(object_id)
                print(f"[WEBHOOK] Processing contact (generic): {contact_id}")
                background_tasks.add_task(process_contact, contact_id)

    return {"status": "accepted"}

@app.post("/webhook/form-submission")
async def handle_form_submission(request: Request, background_tasks: BackgroundTasks):
    """Handle form submission webhook."""

    body = await request.body()
    data = await request.json()

    # Handle different formats
    events = data if isinstance(data, list) else [data]

    for event in events:
        if isinstance(event, dict):
            object_id = event.get("objectId")
            if object_id:
                contact_id = str(object_id)
                background_tasks.add_task(process_contact, contact_id)

    return {"status": "accepted"}

async def process_contact(contact_id: str):
    """Full scoring pipeline for a contact."""

    try:
        # 1. Fetch contact
        contact = await hubspot.get_contact(contact_id)

        # 2. Fetch associated company
        company = None
        associations = contact.get("associations", {}).get("companies", {}).get("results", [])
        if associations:
            company_id = str(associations[0]["id"])
            company = await hubspot.get_company(company_id)

        # 3. Calculate score
        score = calculate_score(contact, company)

        # 4. Update contact properties
        await hubspot.update_contact(contact_id, {
            "als2_total_score": str(score["total_score"]),
            "als2_fit_score": str(score["fit_score"]),
            "als2_intent_score": str(score["intent_score"]),
            "als2_momentum_score": str(score["momentum_score"]),
            "als2_penalties": str(score["penalties"]),
            "als2_routing": score["routing"],
            "als2_priority": score["priority"],
            "als2_reasons": "\n".join(score["reasons"])
        })

        # 5. Add timeline note
        await hubspot.add_timeline_event(
            contact_id,
            "SCORED",
            f"Score: {score['total_score']}/100 | Route: {score['routing']} {score['priority']}"
        )

        # 6. Create task for hot leads
        if score["routing"] == "AE":
            # Generate AI insights
            insights = await ai.generate_insights(contact, company, score)
            outreach = await ai.generate_outreach(contact, score)

            task_body = f"""HOT LEAD - P0 Priority

Score: {score['total_score']}/100
Routing: {score['routing']} ({score['priority']})

Reasons:
{chr(10).join(score['reasons'])}

AI Insights:
{insights}

Suggested Opening:
{outreach}
"""
            await hubspot.create_task(
                contact_id,
                f"P0: Call {contact['properties'].get('firstname', 'Lead')} - Score {score['total_score']}",
                task_body
            )

        # 7. Send to Make.com for automation (if configured)
        if MAKE_WEBHOOK_URL:
            await send_to_make(contact_id, score, contact['properties'])

        print(f"[OK] Scored contact {contact_id}: {score['total_score']} -> {score['routing']}")

    except Exception as e:
        print(f"[ERROR] Error processing contact {contact_id}: {e}")


async def send_to_make(contact_id: str, score: dict, props: dict):
    """Send scored lead data to Make.com for automation."""
    try:
        payload = {
            "contact_id": contact_id,
            "score": score["total_score"],
            "fit_score": score["fit_score"],
            "intent_score": score["intent_score"],
            "momentum_score": score["momentum_score"],
            "routing": score["routing"],
            "priority": score["priority"],
            "reasons": score["reasons"],
            "firstname": props.get("firstname", ""),
            "lastname": props.get("lastname", ""),
            "email": props.get("email", ""),
            "company": props.get("company", ""),
            "jobtitle": props.get("jobtitle", ""),
            "phone": props.get("phone", ""),
            "hubspot_url": f"https://app-eu1.hubspot.com/contacts/147594508/record/0-1/{contact_id}",
            "timestamp": datetime.now().isoformat()
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(MAKE_WEBHOOK_URL, json=payload, timeout=10.0)
            if response.status_code in [200, 201]:
                print(f"[MAKE] Sent to Make.com: {score['routing']} lead")
            else:
                print(f"[MAKE] Warning: Make.com returned {response.status_code}")

    except Exception as e:
        print(f"[MAKE] Error sending to Make.com: {e}")

# =============================================================================
# MANUAL SCORING ENDPOINTS
# =============================================================================

@app.post("/score/{contact_id}")
async def score_contact_manual(contact_id: str):
    """Manually trigger scoring for a contact."""

    if not HUBSPOT_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="HubSpot token not configured")

    await process_contact(contact_id)

    # Fetch updated contact
    contact = await hubspot.get_contact(contact_id)

    return {
        "contact_id": contact_id,
        "total_score": contact["properties"].get("als2_total_score"),
        "routing": contact["properties"].get("als2_routing"),
        "priority": contact["properties"].get("als2_priority"),
        "reasons": contact["properties"].get("als2_reasons", "").split("\n")
    }

@app.post("/score-batch")
async def score_batch(contact_ids: List[str], background_tasks: BackgroundTasks):
    """Score multiple contacts in background."""

    for contact_id in contact_ids:
        background_tasks.add_task(process_contact, contact_id)

    return {
        "status": "processing",
        "count": len(contact_ids)
    }

# =============================================================================
# MCP TOOLS (for Claude Desktop integration)
# =============================================================================

@app.get("/mcp/tools")
async def list_mcp_tools():
    """List available MCP tools for Claude Desktop."""
    return {
        "tools": [
            {
                "name": "score_hubspot_lead",
                "description": "Score a HubSpot contact using ALS2 lead scoring engine",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "contact_id": {
                            "type": "string",
                            "description": "HubSpot contact ID to score"
                        }
                    },
                    "required": ["contact_id"]
                }
            },
            {
                "name": "get_lead_insights",
                "description": "Get AI-powered insights about a HubSpot lead",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "contact_id": {
                            "type": "string",
                            "description": "HubSpot contact ID"
                        }
                    },
                    "required": ["contact_id"]
                }
            },
            {
                "name": "list_hot_leads",
                "description": "List all P0 (hot) leads that need immediate attention",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of leads to return",
                            "default": 10
                        }
                    }
                }
            }
        ]
    }

@app.post("/mcp/execute")
async def execute_mcp_tool(request: Request):
    """Execute an MCP tool call."""

    data = await request.json()
    tool_name = data.get("name")
    arguments = data.get("arguments", {})

    if tool_name == "score_hubspot_lead":
        contact_id = arguments.get("contact_id")
        result = await score_contact_manual(contact_id)
        return {"result": result}

    elif tool_name == "get_lead_insights":
        contact_id = arguments.get("contact_id")
        contact = await hubspot.get_contact(contact_id)

        # Get associated company
        company = None
        associations = contact.get("associations", {}).get("companies", {}).get("results", [])
        if associations:
            company = await hubspot.get_company(str(associations[0]["id"]))

        score = calculate_score(contact, company)
        insights = await ai.generate_insights(contact, company, score)

        return {
            "result": {
                "contact": f"{contact['properties'].get('firstname')} {contact['properties'].get('lastname')}",
                "score": score["total_score"],
                "routing": score["routing"],
                "insights": insights
            }
        }

    elif tool_name == "list_hot_leads":
        limit = arguments.get("limit", 10)

        # Search for P0 leads
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{HUBSPOT_API}/crm/v3/objects/contacts/search",
                headers=hubspot.headers,
                json={
                    "filterGroups": [{
                        "filters": [{
                            "propertyName": "als2_priority",
                            "operator": "EQ",
                            "value": "P0"
                        }]
                    }],
                    "properties": ["email", "firstname", "lastname", "als2_total_score", "als2_routing"],
                    "limit": limit,
                    "sorts": [{"propertyName": "als2_total_score", "direction": "DESCENDING"}]
                }
            )
            data = response.json()

        leads = []
        for contact in data.get("results", []):
            props = contact.get("properties", {})
            leads.append({
                "id": contact["id"],
                "name": f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                "email": props.get("email"),
                "score": props.get("als2_total_score")
            })

        return {"result": {"hot_leads": leads, "count": len(leads)}}

    raise HTTPException(status_code=400, detail=f"Unknown tool: {tool_name}")

# =============================================================================
# HEALTH & INFO
# =============================================================================

@app.get("/healthz")
async def health():
    return {
        "ok": True,
        "service": "ALS2 HubSpot Private App",
        "version": "2.0.0",
        "hubspot_configured": bool(HUBSPOT_ACCESS_TOKEN),
        "ai_configured": bool(ANTHROPIC_API_KEY or OPENAI_API_KEY)
    }

@app.get("/")
async def root():
    return {
        "name": "ALS2 - Adaptive Lead Scoring Engine",
        "type": "HubSpot Private App + MCP Server",
        "endpoints": {
            "webhook_contact": "POST /webhook/contact-created",
            "webhook_form": "POST /webhook/form-submission",
            "manual_score": "POST /score/{contact_id}",
            "batch_score": "POST /score-batch",
            "mcp_tools": "GET /mcp/tools",
            "mcp_execute": "POST /mcp/execute",
            "sync_salesforce": "POST /sync-salesforce/{contact_id}",
            "one_pager": "POST /one-pager/{contact_id}"
        }
    }

# =============================================================================
# CONTACT RESOLUTION HELPER
# =============================================================================

DEMO_CONTACT = {
    "id": "demo",
    "properties": {
        "firstname": "Alex",
        "lastname": "Shapira",
        "jobtitle": "CMO",
        "company": "TechVision Ltd",
        "email": "alex@techvision.io",
        "als2_total_score": "72",
        "als2_fit_score": "35",
        "als2_intent_score": "28",
        "als2_momentum_score": "9",
        "als2_routing": "AE",
        "als2_priority": "P1",
        "als2_reasons": "\u2713 Business email domain \u2192 +10\n\u2713 C-Level title match \u2192 +15\n\u2713 Visited pricing page \u2192 +20\n\u2713 Active within 48h \u2192 +9\n\u25B3 No demo request yet \u2192 -3"
    }
}

async def _resolve_contact(contact_id: str, email: str = None) -> dict:
    """Resolve a contact from HubSpot ID, email, or fallback to demo data.

    Handles:
    - Numeric IDs → HubSpot contact lookup
    - Email parameter → HubSpot search by email
    - Non-numeric IDs (Salesforce) → demo data for presentation
    """
    # Try email lookup first if provided
    if email:
        try:
            contact = await hubspot.search_by_email(email)
            if contact:
                return contact
        except Exception:
            pass

    # Numeric = HubSpot ID
    if contact_id.isdigit():
        try:
            return await hubspot.get_contact(contact_id)
        except Exception:
            pass

    # Non-numeric (Salesforce ID like 00Q...) → return demo data
    return DEMO_CONTACT

# =============================================================================
# CONTACT ENDPOINT (for CRM embed)
# =============================================================================

@app.get("/contact/{contact_id}")
async def get_contact_endpoint(contact_id: str, email: str = None):
    """Get contact details including ALS2 scores.

    Supports HubSpot ID (numeric), email lookup, or Salesforce ID (demo fallback).
    """
    try:
        return await _resolve_contact(contact_id, email)
    except Exception as e:
        return {"error": str(e), "properties": {}}

# =============================================================================
# EMAIL TEMPLATE GENERATOR
# =============================================================================

@app.post("/email-template/{contact_id}")
async def generate_email_template(contact_id: str, template_type: str = "outreach", email: str = None):
    """Generate AI-powered email template for a lead."""

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    contact = await _resolve_contact(contact_id, email)
    props = contact.get("properties", {})

    template_prompts = {
        "outreach": "Write a cold outreach email",
        "follow_up": "Write a follow-up email after initial contact",
        "demo_invite": "Write an email inviting them to a product demo",
        "case_study": "Write an email sharing a relevant case study",
        "pricing": "Write an email with pricing information"
    }

    prompt_type = template_prompts.get(template_type, template_prompts["outreach"])

    prompt = f"""{prompt_type} for this lead:

Contact: {props.get('firstname', '')} {props.get('lastname', '')}
Title: {props.get('jobtitle', 'Unknown')}
Company: {props.get('company', 'Unknown')}
Email: {props.get('email', '')}
ALS2 Score: {props.get('als2_total_score', 'N/A')}/100
Routing: {props.get('als2_routing', 'Unknown')}

Write:
1. A compelling subject line
2. A professional email body (3-4 paragraphs)
3. A clear call-to-action

Format the response as:
SUBJECT: [subject line]
BODY:
[email body]

Keep it conversational, professional, and personalized."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-5-nano-2025-08-07",
                "messages": [{"role": "user", "content": prompt}],
                "max_completion_tokens": 4000
            },
            timeout=60.0
        )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"] or ""

            # Parse subject and body
            subject = ""
            body = content
            if "SUBJECT:" in content:
                parts = content.split("BODY:", 1)
                subject = parts[0].replace("SUBJECT:", "").strip()
                body = parts[1].strip() if len(parts) > 1 else content

            return {
                "success": True,
                "contact_id": contact_id,
                "template_type": template_type,
                "subject": subject,
                "body": body,
                "full_email": content,
                "generated_at": datetime.now().isoformat()
            }

        error_detail = response.text[:300] if response.text else "Unknown error"
        raise HTTPException(status_code=500, detail=f"GPT API error {response.status_code}: {error_detail}")

# =============================================================================
# MEETING PREP GENERATOR
# =============================================================================

@app.post("/meeting-prep/{contact_id}")
async def generate_meeting_prep(contact_id: str, email: str = None):
    """Generate AI-powered meeting preparation brief."""

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    contact = await _resolve_contact(contact_id, email)
    props = contact.get("properties", {})

    company = None
    associations = contact.get("associations", {}).get("companies", {}).get("results", [])
    if associations:
        company = await hubspot.get_company(str(associations[0]["id"]))
    company_props = company.get("properties", {}) if company else {}

    prompt = f"""Prepare a meeting brief for a sales call with this lead:

CONTACT:
- Name: {props.get('firstname', '')} {props.get('lastname', '')}
- Title: {props.get('jobtitle', 'Unknown')}
- Company: {props.get('company') or company_props.get('name', 'Unknown')}
- Industry: {company_props.get('industry', 'Unknown')}
- Company Size: {company_props.get('numberofemployees', 'Unknown')} employees

SCORING:
- ALS2 Score: {props.get('als2_total_score', 'N/A')}/100
- Routing: {props.get('als2_routing', 'Unknown')} ({props.get('als2_priority', 'Unknown')})
- Reasons: {props.get('als2_reasons', 'N/A')}

Generate a meeting prep with these sections:

## Pre-Call Research
(3 bullet points about what to research before the call)

## Discovery Questions
(4-5 open-ended questions to ask during the call)

## Value Propositions
(3 key value props relevant to their industry and role)

## Potential Objections & Responses
(3 common objections with suggested responses)

## Meeting Agenda
(5-step agenda for a 30-minute call)

Keep it actionable and specific to this lead's profile."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-5-nano-2025-08-07",
                "messages": [{"role": "user", "content": prompt}],
                "max_completion_tokens": 5000
            },
            timeout=60.0
        )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"] or ""

            return {
                "success": True,
                "contact_id": contact_id,
                "contact_name": f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                "company": props.get('company') or company_props.get('name'),
                "meeting_prep": content,
                "generated_at": datetime.now().isoformat()
            }

        error_detail = response.text[:300] if response.text else "Unknown error"
        raise HTTPException(status_code=500, detail=f"GPT API error {response.status_code}: {error_detail}")

# =============================================================================
# HOT LEADS ENDPOINT
# =============================================================================

@app.get("/hot-leads")
async def get_hot_leads(limit: int = 10):
    """Get P0 hot leads from HubSpot."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{HUBSPOT_API}/crm/v3/objects/contacts/search",
            headers=hubspot.headers,
            json={
                "filterGroups": [{
                    "filters": [{
                        "propertyName": "als2_priority",
                        "operator": "EQ",
                        "value": "P0"
                    }]
                }],
                "properties": ["firstname", "lastname", "email", "company", "als2_total_score", "als2_routing"],
                "limit": limit,
                "sorts": [{"propertyName": "als2_total_score", "direction": "DESCENDING"}]
            }
        )

        if response.status_code == 200:
            data = response.json()
            leads = []
            for contact in data.get("results", []):
                props = contact.get("properties", {})
                leads.append({
                    "id": contact["id"],
                    "name": f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                    "email": props.get("email"),
                    "company": props.get("company"),
                    "score": props.get("als2_total_score"),
                    "routing": props.get("als2_routing")
                })
            return {"hot_leads": leads, "count": len(leads)}
        return {"error": f"Search failed: {response.status_code}", "hot_leads": [], "count": 0}

# =============================================================================
# SALESFORCE SYNC
# =============================================================================

@app.post("/sync-salesforce/{contact_id}")
async def sync_to_salesforce(contact_id: str, salesforce_account_id: str = None, email: str = None):
    """Sync a scored lead to Salesforce (mock for demo)."""

    contact = await _resolve_contact(contact_id, email)
    props = contact.get("properties", {})

    # Mock Salesforce sync response
    return {
        "success": True,
        "salesforce_lead_id": f"00Q{contact_id[:10]}",
        "synced_at": datetime.now().isoformat(),
        "synced_fields": {
            "FirstName": props.get("firstname"),
            "LastName": props.get("lastname"),
            "Email": props.get("email"),
            "Company": props.get("company"),
            "Title": props.get("jobtitle"),
            "ALS2_Score__c": props.get("als2_total_score"),
            "ALS2_Routing__c": props.get("als2_routing"),
            "ALS2_Priority__c": props.get("als2_priority"),
            "ALS2_Reasons__c": props.get("als2_reasons")
        },
        "message": f"Lead synced to Salesforce. Routing: {props.get('als2_routing')} | Priority: {props.get('als2_priority')}"
    }

# =============================================================================
# ONE-PAGER GENERATOR (GPT-4o-mini)
# =============================================================================

@app.post("/one-pager/{contact_id}")
async def generate_one_pager(contact_id: str, template: str = "executive", email: str = None):
    """Generate AI-powered one-pager for a lead."""

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    # Resolve contact - support HubSpot ID, email lookup, or Salesforce ID
    contact = await _resolve_contact(contact_id, email)
    props = contact.get("properties", {})

    # Get company if available
    company = None
    associations = contact.get("associations", {}).get("companies", {}).get("results", [])
    if associations:
        company = await hubspot.get_company(str(associations[0]["id"]))

    company_props = company.get("properties", {}) if company else {}

    # Build GPT prompt
    prompt = f"""Generate a professional {template} one-pager summary for this sales lead:

CONTACT INFORMATION:
- Name: {props.get('firstname', '')} {props.get('lastname', '')}
- Title: {props.get('jobtitle', 'Unknown')}
- Email: {props.get('email', 'Unknown')}
- Phone: {props.get('phone', 'N/A')}

COMPANY INFORMATION:
- Company: {props.get('company') or company_props.get('name', 'Unknown')}
- Industry: {company_props.get('industry', 'Unknown')}
- Size: {company_props.get('numberofemployees', 'Unknown')} employees
- Website: {company_props.get('domain', 'N/A')}

ALS2 SCORING:
- Total Score: {props.get('als2_total_score', 'N/A')}/100
- Fit Score: {props.get('als2_fit_score', 'N/A')}/50
- Intent Score: {props.get('als2_intent_score', 'N/A')}/40
- Momentum Score: {props.get('als2_momentum_score', 'N/A')}/10
- Routing: {props.get('als2_routing', 'Unknown')}
- Priority: {props.get('als2_priority', 'Unknown')}
- Scoring Reasons: {props.get('als2_reasons', 'N/A')}

Generate a compelling one-pager with these sections:

## Executive Summary
(2-3 sentences summarizing the opportunity)

## Key Opportunity Signals
(3 bullet points highlighting why this lead is valuable)

## Recommended Approach
(2-3 specific talking points for the sales call)

## Next Steps
(3 concrete action items with owners)

Keep it concise, actionable, and focused on value for the sales team."""

    # Call GPT-4o-mini
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-5-nano-2025-08-07",
                "messages": [{"role": "user", "content": prompt}],
                "max_completion_tokens": 5000
            },
            timeout=60.0
        )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            return {
                "success": True,
                "contact_id": contact_id,
                "contact_name": f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                "company": props.get('company') or company_props.get('name'),
                "template": template,
                "one_pager": content,
                "generated_at": datetime.now().isoformat(),
                "als2_score": props.get("als2_total_score"),
                "als2_routing": props.get("als2_routing")
            }

        error_detail = response.text[:300] if response.text else "Unknown error"
        raise HTTPException(status_code=500, detail=f"GPT API error {response.status_code}: {error_detail}")

# =============================================================================
# AI CHAT ASSISTANT (MCP-style, inside CRM)
# =============================================================================

@app.post("/chat/{contact_id}")
async def chat_with_assistant(contact_id: str, request: Request, email: str = None):
    """AI chat assistant for CRM embed. Routes user intent to MCP tools."""

    if not OPENAI_API_KEY:
        return {"reply": "AI not configured. Please set OPENAI_API_KEY.", "tool_used": None}

    data = await request.json()
    user_message = data.get("message", "").strip()
    if not user_message:
        return {"reply": "Please type a question.", "tool_used": None}

    # Resolve contact
    contact = await _resolve_contact(contact_id, email)
    props = contact.get("properties", {})
    contact_name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip() or "this contact"

    # Sales intelligence AI assistant
    system_prompt = f"""You are ALS2 AI Sales Co-Pilot, embedded inside a CRM (HubSpot/Salesforce). You are an expert B2B sales strategist helping reps close deals faster.

CURRENT LEAD CONTEXT:
- Name: {contact_name}
- Title: {props.get('jobtitle', 'Unknown')}
- Company: {props.get('company', 'Unknown')}
- ALS2 Score: {props.get('als2_total_score', 'N/A')}/100
- Fit: {props.get('als2_fit_score', 'N/A')}/50 | Intent: {props.get('als2_intent_score', 'N/A')}/40 | Momentum: {props.get('als2_momentum_score', 'N/A')}/10
- Routing: {props.get('als2_routing', 'Unknown')} | Priority: {props.get('als2_priority', 'Unknown')}
- Scoring Reasons: {props.get('als2_reasons', 'N/A')}

YOUR EXPERTISE:
- Approach strategies (cold outreach, warm follow-up, executive selling)
- Closing techniques (trial close, assumptive close, urgency, FOMO)
- Objection handling (budget, timing, competitor, authority, need)
- Discovery frameworks (BANT, MEDDIC, SPIN, Challenger)
- Pain point analysis by role and industry
- Competitive positioning and differentiation
- Value proposition crafting
- Industry trends and talking points
- Negotiation tactics
- Deal acceleration strategies

INSTRUCTIONS:
1. Always tailor advice to THIS specific contact's title, company, score, and industry
2. Be actionable — give specific phrases, questions, and tactics the rep can use RIGHT NOW
3. Use bold for key points and bullets for lists
4. Keep responses focused (3-6 bullet points or 2-3 short paragraphs)
5. Do NOT mention tools, APIs, or system features — focus purely on sales strategy and advice
6. Think like a top-performing AE coaching a teammate"""

    try:
        # Combine system + user into single user message (reasoning models don't support system role)
        full_prompt = f"{system_prompt}\n\n---\n\nSALES REP QUESTION: {user_message}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-5-nano-2025-08-07",
                    "messages": [
                        {"role": "user", "content": full_prompt}
                    ],
                    "max_completion_tokens": 8000
                },
                timeout=45.0
            )

            if response.status_code == 200:
                resp_data = response.json()
                reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
                # Check if reasoning model ran out of tokens (content empty, finish_reason=length)
                finish = resp_data.get("choices", [{}])[0].get("finish_reason", "")
                if not reply.strip() and finish == "length":
                    reply = "The AI used all tokens for reasoning. Please try a shorter question."
                elif not reply.strip():
                    reply = "I couldn't generate a response. Please try again."

                return {
                    "reply": reply,
                    "tools_used": [],
                    "contact_name": contact_name
                }

            print(f"[CHAT] GPT error {response.status_code}: {response.text[:300]}")
            return {"reply": f"AI error ({response.status_code}). Try again.", "tools_used": []}

    except Exception as e:
        return {"reply": f"Connection error: {str(e)[:100]}", "tools_used": []}

# =============================================================================
# HUBSPOT SETUP & TIER MANAGEMENT ENDPOINTS
# =============================================================================

def determine_tier(score: int) -> dict:
    """Determine lead tier based on score."""
    if score >= 80:
        return {"tier": "tier_1_hot", "label": "Tier 1 - Hot", "sla": "1 hour", "routing": "AE", "priority": "P0"}
    elif score >= 60:
        return {"tier": "tier_2_warm", "label": "Tier 2 - Warm", "sla": "4 hours", "routing": "SDR", "priority": "P1"}
    elif score >= 40:
        return {"tier": "tier_3_cool", "label": "Tier 3 - Cool", "sla": "24 hours", "routing": "SDR", "priority": "P2"}
    else:
        return {"tier": "tier_4_cold", "label": "Tier 4 - Cold", "sla": "72 hours", "routing": "Nurture", "priority": "P2"}


@app.post("/setup-hubspot")
async def setup_hubspot_properties():
    """Create all ALS2 custom properties in HubSpot. Run once to configure."""
    results = {"created": [], "skipped": [], "errors": []}

    # Create property group
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{HUBSPOT_API}/crm/v3/properties/contacts/groups",
            headers=hubspot.headers,
            json={"name": "als2_scoring", "label": "Lead Scoring (ALS2)", "displayOrder": 1}
        )
        if resp.status_code == 201:
            results["created"].append("Property group: als2_scoring")
        elif resp.status_code == 409:
            results["skipped"].append("Property group: als2_scoring (exists)")

    # All ALS2 properties including Lead Tier
    properties = [
        {"name": "als2_total_score", "label": "ALS2 Total Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Combined lead score (0-100)"},
        {"name": "als2_fit_score", "label": "ALS2 Fit Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Company fit score (0-50)"},
        {"name": "als2_intent_score", "label": "ALS2 Intent Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Buyer intent score (0-40)"},
        {"name": "als2_momentum_score", "label": "ALS2 Momentum Score", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Activity recency (0-10)"},
        {"name": "als2_penalties", "label": "ALS2 Penalties", "type": "number", "fieldType": "number", "groupName": "als2_scoring", "description": "Score deductions"},
        {"name": "als2_routing", "label": "ALS2 Routing", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring",
         "options": [{"label": "AE", "value": "AE", "displayOrder": 1}, {"label": "SDR", "value": "SDR", "displayOrder": 2}, {"label": "Nurture", "value": "Nurture", "displayOrder": 3}]},
        {"name": "als2_priority", "label": "ALS2 Priority", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring",
         "options": [{"label": "P0 - Hot", "value": "P0", "displayOrder": 1}, {"label": "P1 - Warm", "value": "P1", "displayOrder": 2}, {"label": "P2 - Cold", "value": "P2", "displayOrder": 3}]},
        {"name": "als2_lead_tier", "label": "ALS2 Lead Tier", "type": "enumeration", "fieldType": "select", "groupName": "als2_scoring", "description": "4-tier lead classification",
         "options": [
             {"label": "Tier 1 - Hot (80-100)", "value": "tier_1_hot", "displayOrder": 1},
             {"label": "Tier 2 - Warm (60-79)", "value": "tier_2_warm", "displayOrder": 2},
             {"label": "Tier 3 - Cool (40-59)", "value": "tier_3_cool", "displayOrder": 3},
             {"label": "Tier 4 - Cold (0-39)", "value": "tier_4_cold", "displayOrder": 4}
         ]},
        {"name": "als2_tier_sla", "label": "ALS2 Tier SLA", "type": "string", "fieldType": "text", "groupName": "als2_scoring", "description": "SLA target for this tier"},
        {"name": "als2_reasons", "label": "ALS2 Score Reasons", "type": "string", "fieldType": "textarea", "groupName": "als2_scoring"},
        {"name": "als2_last_scored", "label": "ALS2 Last Scored", "type": "datetime", "fieldType": "date", "groupName": "als2_scoring"},
        {"name": "als2_score_change", "label": "ALS2 Score Change", "type": "number", "fieldType": "number", "groupName": "als2_scoring"},
        {"name": "als2_ai_insights", "label": "ALS2 AI Insights", "type": "string", "fieldType": "textarea", "groupName": "als2_scoring"},
    ]

    async with httpx.AsyncClient() as client:
        for prop in properties:
            resp = await client.post(
                f"{HUBSPOT_API}/crm/v3/properties/contacts",
                headers=hubspot.headers,
                json=prop
            )
            if resp.status_code == 201:
                results["created"].append(prop["label"])
            elif resp.status_code == 409:
                results["skipped"].append(f"{prop['label']} (exists)")
            else:
                results["errors"].append(f"{prop['name']}: {resp.text[:200]}")

    return {"success": True, "summary": f"Created {len(results['created'])}, Skipped {len(results['skipped'])}, Errors {len(results['errors'])}", **results}


@app.post("/set-tier/{contact_id}")
async def set_lead_tier(contact_id: str):
    """Calculate and set lead tier for a contact based on their ALS2 score."""
    contact_data = await hubspot.get_contact(contact_id)
    if not contact_data:
        raise HTTPException(status_code=404, detail="Contact not found")

    props = contact_data.get("properties", {})
    score_str = props.get("als2_total_score", "0")
    score = int(float(score_str)) if score_str else 0

    tier_info = determine_tier(score)

    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{HUBSPOT_API}/crm/v3/objects/contacts/{contact_id}",
            headers=hubspot.headers,
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
                **tier_info
            }
        raise HTTPException(status_code=resp.status_code, detail=f"Failed to update: {resp.text[:200]}")


@app.post("/set-tier-all")
async def set_all_lead_tiers():
    """Set tiers for ALL scored contacts in HubSpot."""
    results = {"updated": [], "errors": []}

    async with httpx.AsyncClient() as client:
        # Search for contacts with ALS2 scores
        resp = await client.post(
            f"{HUBSPOT_API}/crm/v3/objects/contacts/search",
            headers=hubspot.headers,
            json={
                "filterGroups": [{"filters": [{"propertyName": "als2_total_score", "operator": "HAS_PROPERTY"}]}],
                "properties": ["firstname", "lastname", "als2_total_score"],
                "limit": 100
            }
        )

        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Search failed")

        contacts = resp.json().get("results", [])

        for contact in contacts:
            cid = contact["id"]
            props = contact.get("properties", {})
            score = int(float(props.get("als2_total_score", "0") or "0"))
            tier_info = determine_tier(score)

            update_resp = await client.patch(
                f"{HUBSPOT_API}/crm/v3/objects/contacts/{cid}",
                headers=hubspot.headers,
                json={
                    "properties": {
                        "als2_lead_tier": tier_info["tier"],
                        "als2_tier_sla": tier_info["sla"],
                        "als2_routing": tier_info["routing"],
                        "als2_priority": tier_info["priority"]
                    }
                }
            )

            name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
            if update_resp.status_code == 200:
                results["updated"].append({"name": name, "score": score, "tier": tier_info["label"]})
            else:
                results["errors"].append({"name": name, "error": update_resp.text[:100]})

    return {"success": True, "total": len(results["updated"]), **results}


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
