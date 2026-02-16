"""
ALS2 Demo Lead Seeder - All-in-One
===================================
Creates 20 contacts in HubSpot with correct international phones,
writes ALS2 scores, generates AI one-pagers via GPT, and writes
clickable one-pager URLs back to HubSpot.

Pipeline per contact:
  Create -> Score -> Write ALS2 props -> Generate One-Pager -> Write URL

Usage:
  python seed_demo_leads.py
"""

import requests
import time
import os
import re

HUBSPOT_TOKEN = os.environ.get("HUBSPOT_ACCESS_TOKEN", os.environ.get("HUBSPOT_TOKEN", ""))
HUBSPOT_API = "https://api.hubapi.com"
HEADERS = {
    "Authorization": "Bearer %s" % HUBSPOT_TOKEN,
    "Content-Type": "application/json"
}

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", os.environ.get("OPENAI_KEY", ""))

FREE_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"]
HIGH_VALUE_INDUSTRIES = ["technology", "it services", "managed services", "msp", "software", "saas", "cybersecurity", "fintech"]

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "one-pagers")

# =============================================================================
# 20 DEMO LEADS - international phones, diverse countries
# =============================================================================

DEMO_LEADS = [
    # === TIER 1: HOT (80-100) ================================================
    {   # USA - San Francisco
        "firstname": "Sarah", "lastname": "Chen",
        "email": "sarah.chen@cybershield-tech.com",
        "jobtitle": "CTO",
        "phone": "+1 (415) 739-2841",
        "company": "CyberShield Technologies",
        "industry": "cybersecurity", "employees": 850, "abm": True,
        "source": "demo",
    },
    {   # USA - New York
        "firstname": "Marcus", "lastname": "Williams",
        "email": "m.williams@nexgenit.com",
        "jobtitle": "VP of IT Operations",
        "phone": "+1 (212) 485-7103",
        "company": "NexGen IT Solutions",
        "industry": "it services", "employees": 1200, "abm": True,
        "source": "demo",
    },
    {   # South Korea - Seoul
        "firstname": "Jennifer", "lastname": "Park",
        "email": "jpark@cloudvault-msp.com",
        "jobtitle": "Director of Technology",
        "phone": "+82 2 3456 7890",
        "company": "CloudVault MSP",
        "industry": "managed services", "employees": 600, "abm": True,
        "source": "pricing",
    },
    {   # Germany - Munich
        "firstname": "David", "lastname": "Mueller",
        "email": "david.mueller@techfusion.com",
        "jobtitle": "CIO",
        "phone": "+49 89 2351 6740",
        "company": "TechFusion Corp",
        "industry": "technology", "employees": 2500, "abm": True,
        "source": "demo",
    },
    {   # Brazil - Sao Paulo
        "firstname": "Rachel", "lastname": "Torres",
        "email": "rtorres@datastream-net.com",
        "jobtitle": "Head of Infrastructure",
        "phone": "+55 11 9876 5432",
        "company": "DataStream Networks",
        "industry": "it services", "employees": 500, "abm": True,
        "source": "demo",
    },

    # === TIER 2: WARM (60-79) ================================================
    {   # UK - London
        "firstname": "Alex", "lastname": "Johnson",
        "email": "alex.j@alphanet-solutions.com",
        "jobtitle": "IT Manager",
        "phone": "+44 20 7946 0321",
        "company": "AlphaNet Solutions",
        "industry": "it services", "employees": 250, "abm": False,
        "source": "pricing",
    },
    {   # Israel - Tel Aviv
        "firstname": "Nina", "lastname": "Petrov",
        "email": "nina@secureops.io",
        "jobtitle": "Senior Security Engineer",
        "phone": "+972 3 612 8845",
        "company": "SecureOps Ltd",
        "industry": "cybersecurity", "employees": 180, "abm": False,
        "source": "trial",
    },
    {   # USA - Chicago
        "firstname": "Tom", "lastname": "Bradley",
        "email": "tbradley@midwest-it.com",
        "jobtitle": "Operations Lead",
        "phone": "+1 (312) 867-5309",
        "company": "MidWest IT Group",
        "industry": "managed services", "employees": 120, "abm": False,
        "source": "demo",
    },
    {   # Japan - Tokyo (no phone = scoring penalty)
        "firstname": "Lisa", "lastname": "Nakamura",
        "email": "lisa.n@pinnacle-soft.com",
        "jobtitle": "Manager of DevOps",
        "phone": "",
        "company": "Pinnacle Software",
        "industry": "software", "employees": 300, "abm": True,
        "source": "pricing",
    },
    {   # Mexico - Mexico City
        "firstname": "Carlos", "lastname": "Reyes",
        "email": "creyes@bluechip-consult.com",
        "jobtitle": "Lead Systems Architect",
        "phone": "+52 55 4821 6390",
        "company": "BlueChip Consulting",
        "industry": "technology", "employees": 150, "abm": False,
        "source": "trial",
    },
    {   # Germany - Berlin
        "firstname": "Emma", "lastname": "Fischer",
        "email": "emma.f@omnitech-svc.com",
        "jobtitle": "IT Director",
        "phone": "+49 30 5567 8912",
        "company": "OmniTech Services",
        "industry": "it services", "employees": 200, "abm": False,
        "source": "contact",
    },

    # === TIER 3: COOL (40-59) ================================================
    {   # Ireland - Dublin
        "firstname": "Brian", "lastname": "Walsh",
        "email": "brian@greenleaf-accounting.com",
        "jobtitle": "Office Manager",
        "phone": "+353 1 234 5678",
        "company": "GreenLeaf Accounting",
        "industry": "financial services", "employees": 45, "abm": False,
        "source": "contact",
    },
    {   # India - Mumbai (no phone)
        "firstname": "Priya", "lastname": "Sharma",
        "email": "priya@harbor-medical-it.com",
        "jobtitle": "IT Coordinator",
        "phone": "",
        "company": "Harbor Medical IT",
        "industry": "healthcare", "employees": 80, "abm": False,
        "source": "trial",
    },
    {   # Australia - Sydney
        "firstname": "Kevin", "lastname": "OBrien",
        "email": "kevin@redwood-logistics.com",
        "jobtitle": "Systems Administrator",
        "phone": "+61 2 8765 4321",
        "company": "Redwood Logistics",
        "industry": "logistics", "employees": 60, "abm": False,
        "source": "contact",
    },
    {   # Singapore (no phone)
        "firstname": "Amy", "lastname": "Zhang",
        "email": "amy.z@summit-construct.com",
        "jobtitle": "Project Manager",
        "phone": "",
        "company": "Summit Construction Tech",
        "industry": "construction", "employees": 35, "abm": False,
        "source": "contact",
    },
    {   # Canada - Toronto
        "firstname": "Jordan", "lastname": "Lee",
        "email": "jordan@brightsideedu.org",
        "jobtitle": "Tech Coordinator",
        "phone": "+1 (416) 523-9174",
        "company": "Brightside Education",
        "industry": "education", "employees": 50, "abm": False,
        "source": "trial",
    },

    # === TIER 4: COLD (0-39) =================================================
    {   # USA - Florida (gmail, no phone)
        "firstname": "Mike", "lastname": "Thompson",
        "email": "mike.thompson1985@gmail.com",
        "jobtitle": "Owner",
        "phone": "",
        "company": "Local Pizza Palace",
        "industry": "food & beverage", "employees": 8, "abm": False,
        "source": "general",
    },
    {   # France - Paris (yahoo, no phone)
        "firstname": "Sophie", "lastname": "Martin",
        "email": "sophie.relaxspa@yahoo.com",
        "jobtitle": "",
        "phone": "",
        "company": "Sunny Day Spa",
        "industry": "wellness", "employees": 5, "abm": False,
        "source": "general",
    },
    {   # Netherlands (hotmail, no phone)
        "firstname": "Jake", "lastname": "Miller",
        "email": "jakemiller.dev@hotmail.com",
        "jobtitle": "Freelancer",
        "phone": "",
        "company": "FreshStart Freelance",
        "industry": "consulting", "employees": 2, "abm": False,
        "source": "contact",
    },
    {   # Poland - Warsaw (outlook, has phone)
        "firstname": "Linda", "lastname": "Brown",
        "email": "linda.b.handyman@outlook.com",
        "jobtitle": "Owner",
        "phone": "+48 22 345 6789",
        "company": "QuickFix Handyman",
        "industry": "home services", "employees": 3, "abm": False,
        "source": "general",
    },
]


# =============================================================================
# SCORING ENGINE
# =============================================================================

def calculate_score(lead):
    email = lead.get("email", "")
    phone = lead.get("phone", "")
    job_title = (lead.get("jobtitle") or "").lower()
    source = (lead.get("source") or "").lower()
    company_size = lead.get("employees", 0)
    industry = (lead.get("industry") or "").lower()
    is_abm = lead.get("abm", False)

    fit_score = 0
    intent_score = 0
    momentum_score = 10
    penalties = 0
    reasons = []

    if company_size >= 500:
        fit_score += 20; reasons.append("Enterprise (%d emp) +20" % company_size)
    elif company_size >= 100:
        fit_score += 15; reasons.append("Mid-market (%d emp) +15" % company_size)
    elif company_size >= 20:
        fit_score += 10; reasons.append("SMB (%d emp) +10" % company_size)
    elif company_size > 0:
        fit_score += 5; reasons.append("Small (%d emp) +5" % company_size)

    if is_abm:
        fit_score += 15; reasons.append("ABM target +15")

    if any(ind in industry for ind in HIGH_VALUE_INDUSTRIES):
        fit_score += 10; reasons.append("High-value industry +10")

    if any(t in job_title for t in ["cto", "cio", "vp", "director", "head of"]):
        fit_score += 5; reasons.append("Decision-maker +5")
    elif any(t in job_title for t in ["manager", "lead", "senior"]):
        fit_score += 3; reasons.append("Influencer +3")

    fit_score = min(fit_score, 50)

    if "demo" in source:
        intent_score = 35; reasons.append("Demo request +35")
    elif "pricing" in source:
        intent_score = 30; reasons.append("Pricing inquiry +30")
    elif "trial" in source:
        intent_score = 28; reasons.append("Trial signup +28")
    elif "contact" in source:
        intent_score = 15; reasons.append("Contact form +15")
    else:
        intent_score = 5; reasons.append("General inquiry +5")
    intent_score = min(intent_score, 40)

    reasons.append("Active today +10")

    email_domain = email.split("@")[1] if "@" in email else ""
    if email_domain.lower() in FREE_DOMAINS:
        penalties -= 15; reasons.append("Free email (%s) -15" % email_domain)
    if not phone or len(phone) < 7:
        penalties -= 5; reasons.append("Missing phone -5")

    total_score = max(0, min(100, fit_score + intent_score + momentum_score + penalties))

    if total_score >= 80:
        routing, priority, tier, sla = "AE", "P0", "tier_1_hot", "1 hour"
    elif total_score >= 60:
        routing, priority, tier, sla = "SDR", "P1", "tier_2_warm", "4 hours"
    elif total_score >= 40:
        routing, priority, tier, sla = "Nurture", "P2", "tier_3_cool", "24 hours"
    else:
        routing, priority, tier, sla = "Nurture", "P2", "tier_4_cold", "72 hours"

    return {
        "fit_score": fit_score, "intent_score": intent_score,
        "momentum_score": momentum_score, "penalties": penalties,
        "total_score": total_score, "routing": routing,
        "priority": priority, "tier": tier, "sla": sla, "reasons": reasons,
    }


# =============================================================================
# ONE-PAGER GENERATOR (GPT)
# =============================================================================

def generate_one_pager_md(lead, score):
    """Call GPT to generate one-pager markdown."""
    name = "%s %s" % (lead["firstname"], lead["lastname"])
    prompt = """Generate a professional executive one-pager for this sales lead. Be specific to their role and industry.

CONTACT: %s | %s | %s | %s
COMPANY: %s | %s | %d employees
SCORE: %d/100 | Fit:%d Intent:%d Momentum:%d Penalties:%d
ROUTING: %s (%s) | REASONS: %s

Write these sections in markdown (under 350 words total):

## Executive Summary
(2-3 sentences about the opportunity)

## Key Opportunity Signals
(3 bullet points)

## Recommended Approach
(2-3 talking points for the sales call)

## Next Steps
(3 concrete action items)""" % (
        name, lead.get("jobtitle", ""), lead.get("email", ""), lead.get("phone", "N/A"),
        lead["company"], lead.get("industry", ""), lead.get("employees", 0),
        score["total_score"], score["fit_score"], score["intent_score"],
        score["momentum_score"], score["penalties"],
        score["routing"], score["priority"],
        " | ".join(score["reasons"][:4]),
    )

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": "Bearer %s" % OPENAI_API_KEY, "Content-Type": "application/json"},
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 1200},
            timeout=45
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        else:
            print("    [GPT %d]" % resp.status_code)
            return None
    except Exception as e:
        print("    [GPT ERROR] %s" % str(e)[:80])
        return None


def build_one_pager_html(md_content, name, company, score, priority, routing, email, phone):
    """Convert markdown one-pager to styled HTML."""
    html_body = md_content
    html_body = html_body.replace("## Executive Summary", '<h2 class="section">Executive Summary</h2>')
    html_body = html_body.replace("## Key Opportunity Signals", '<h2 class="section">Key Opportunity Signals</h2>')
    html_body = html_body.replace("## Recommended Approach", '<h2 class="section">Recommended Approach</h2>')
    html_body = html_body.replace("## Next Steps", '<h2 class="section">Next Steps</h2>')
    html_body = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html_body)

    lines = html_body.split("\n")
    out = []
    in_list = False
    for line in lines:
        s = line.strip()
        if s.startswith("- ") or s.startswith("* "):
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append("  <li>%s</li>" % s[2:])
        else:
            if in_list:
                out.append("</ul>"); in_list = False
            if s.startswith("<h2"):
                out.append(s)
            elif s:
                out.append("<p>%s</p>" % s)
    if in_list:
        out.append("</ul>")
    html_body = "\n".join(out)

    colors = {"P0": "#dc2626", "P1": "#f59e0b", "P2": "#6b7280"}
    labels = {"P0": "HOT - Immediate Action", "P1": "WARM - Follow Up", "P2": "COOL/COLD - Nurture"}
    c = colors.get(priority, "#6b7280")
    badge = labels.get(priority, priority)

    return """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ALS2 | %s - %s</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6}
.c{max-width:800px;margin:0 auto;padding:32px 24px}
.hd{background:linear-gradient(135deg,#0f172a,#1e40af);color:#fff;padding:32px;border-radius:12px;margin-bottom:24px}
.hd h1{font-size:26px;margin-bottom:4px}.hd .sub{opacity:.85;font-size:15px}
.meta{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}
.meta span{background:rgba(255,255,255,.15);padding:5px 12px;border-radius:6px;font-size:13px}
.badge{background:%s;color:#fff;padding:4px 14px;border-radius:20px;font-weight:600;font-size:13px}
.sb{display:flex;align-items:center;gap:16px;background:#fff;padding:20px 24px;border-radius:10px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.sc{width:72px;height:72px;border-radius:50%%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;background:%s;flex-shrink:0}
.sd .l{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.sd .r{font-size:18px;font-weight:600}
.ct{background:#fff;padding:28px 32px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ct h2.section{color:#1e40af;font-size:18px;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.ct h2.section:first-child{margin-top:0}
.ct p{margin-bottom:10px}.ct ul{margin:8px 0 16px 20px}.ct li{margin-bottom:6px}.ct strong{color:#0f172a}
.ft{text-align:center;margin-top:24px;color:#94a3b8;font-size:12px}
</style></head><body>
<div class="c">
<div class="hd"><h1>%s</h1><div class="sub">%s</div>
<div class="meta"><span>%s</span><span>%s</span><span class="badge">%s</span></div></div>
<div class="sb"><div class="sc">%s</div><div class="sd"><div class="l">ALS2 Lead Score</div><div class="r">Route to %s | %s</div></div></div>
<div class="ct">%s</div>
<div class="ft">Generated by ALS2 Lead Intelligence Engine | Powered by AI</div>
</div></body></html>""" % (
        name, company, c, c,
        name, company, email, phone or "No phone", badge,
        score, routing, priority, html_body
    )


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def process_lead(lead):
    """Full pipeline: Create -> Score -> One-Pager -> Write to HubSpot."""
    score = calculate_score(lead)
    name = "%s %s" % (lead["firstname"], lead["lastname"])

    # 1. Create contact
    props = {
        "email": lead["email"],
        "firstname": lead["firstname"],
        "lastname": lead["lastname"],
        "company": lead["company"],
        "lifecyclestage": "lead",
        "hs_lead_status": "NEW",
    }
    if lead.get("jobtitle"):
        props["jobtitle"] = lead["jobtitle"]
    if lead.get("phone"):
        props["phone"] = lead["phone"]

    resp = requests.post("%s/crm/v3/objects/contacts" % HUBSPOT_API, headers=HEADERS, json={"properties": props})

    if resp.status_code == 409:
        sr = requests.post("%s/crm/v3/objects/contacts/search" % HUBSPOT_API, headers=HEADERS,
            json={"filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": lead["email"]}]}]})
        results = sr.json().get("results", [])
        if results:
            contact_id = results[0]["id"]
            print("  [EXISTS] %-25s (ID: %s)" % (name, contact_id))
        else:
            print("  [FAIL] %-25s - not found" % name); return None
    elif resp.status_code == 201:
        contact_id = resp.json()["id"]
        print("  [CREATED] %-25s (ID: %s)" % (name, contact_id))
    else:
        print("  [FAIL] %-25s - %s" % (name, resp.text[:100])); return None

    # 2. Write ALS2 scores (including tier + SLA)
    score_props = {
        "als2_total_score": str(score["total_score"]),
        "als2_fit_score": str(score["fit_score"]),
        "als2_intent_score": str(score["intent_score"]),
        "als2_momentum_score": str(score["momentum_score"]),
        "als2_penalties": str(score["penalties"]),
        "als2_routing": score["routing"],
        "als2_priority": score["priority"],
        "als2_lead_tier": score["tier"],
        "als2_tier_sla": score["sla"],
        "als2_reasons": " | ".join(score["reasons"][:6]),
    }
    requests.patch("%s/crm/v3/objects/contacts/%s" % (HUBSPOT_API, contact_id), headers=HEADERS,
        json={"properties": score_props})

    # 3. Generate one-pager via GPT
    slug = lead["email"].split("@")[0].replace(".", "-").replace("_", "-")
    filename = "one-pager-%s.html" % slug

    md = generate_one_pager_md(lead, score)
    if md:
        html = build_one_pager_html(
            md, name, lead["company"], str(score["total_score"]),
            score["priority"], score["routing"], lead["email"], lead.get("phone", "")
        )
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)

        # 4. Write one-pager link to HubSpot - use backend CRM embed URL
        onepager_url = "https://gtmopsbackend.vercel.app/crm-embed-onepager.html?id=%s" % contact_id
        requests.patch("%s/crm/v3/objects/contacts/%s" % (HUBSPOT_API, contact_id), headers=HEADERS,
            json={"properties": {"als2_onepager_link": onepager_url}})
        print("    Score:%3d | %s | %s | One-pager: OK" % (score["total_score"], score["tier"], score["priority"]))
    else:
        print("    Score:%3d | %s | %s | One-pager: SKIP" % (score["total_score"], score["tier"], score["priority"]))

    return {"id": contact_id, "name": name, "email": lead["email"], "company": lead["company"], "score": score}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 72)
    print("  ALS2 DEMO LEAD SEEDER")
    print("  20 Leads | 4 Tiers | International | AI One-Pagers")
    print("=" * 72)
    print()

    results = {"tier_1_hot": [], "tier_2_warm": [], "tier_3_cool": [], "tier_4_cold": []}

    for i, lead in enumerate(DEMO_LEADS, 1):
        print("[%d/20] %s %s - %s" % (i, lead["firstname"], lead["lastname"], lead["company"]))
        result = process_lead(lead)
        if result:
            results[result["score"]["tier"]].append(result)
        time.sleep(1.5)  # OpenAI rate limit

    # Summary
    print("\n" + "=" * 72)
    print("  RESULTS")
    print("=" * 72)

    for tier_key, label in [
        ("tier_1_hot", "TIER 1 HOT  (80-100) -> AE"),
        ("tier_2_warm", "TIER 2 WARM (60-79)  -> SDR"),
        ("tier_3_cool", "TIER 3 COOL (40-59)  -> Nurture"),
        ("tier_4_cold", "TIER 4 COLD (0-39)   -> Nurture"),
    ]:
        leads = results[tier_key]
        print("\n  %s  [%d leads]" % (label, len(leads)))
        for r in leads:
            s = r["score"]
            print("    %-22s %-28s Score:%3d  (F:%2d I:%2d M:%2d P:%3d)" % (
                r["name"], r["company"][:26], s["total_score"],
                s["fit_score"], s["intent_score"], s["momentum_score"], s["penalties"]))

    total = sum(len(v) for v in results.values())
    print("\n" + "=" * 72)
    print("  TOTAL: %d/20 created + scored + one-pagers generated" % total)
    print("  One-pagers saved to: %s" % OUTPUT_DIR)
    print("=" * 72)


if __name__ == "__main__":
    main()
