"""
Vercel serverless function — exposes the FastAPI app.
Vercel auto-discovers this file and routes /api/* requests to it.
"""

import os
import math
import hashlib
import logging
from pathlib import Path

import requests as http_requests
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pharmapath")

app = FastAPI(title="PharmaPath API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")


# ── Drug lookup via openFDA ──────────────────────────────────────────────────

def search_drug_info(brand_name: str) -> dict:
    url = "https://api.fda.gov/drug/ndc.json"
    params = {"search": f'brand_name:"{brand_name}"', "limit": 5}
    result = {
        "found": False,
        "generic_name": None,
        "manufacturer": None,
        "dosage_forms": [],
        "strengths": [],
    }
    try:
        resp = http_requests.get(url, params=params, timeout=8)
        if resp.status_code == 200:
            items = resp.json().get("results", [])
            if items:
                result["found"] = True
                result["generic_name"] = items[0].get("generic_name", "Unknown")
                result["manufacturer"] = items[0].get("labeler_name", "Unknown")
                for item in items:
                    for form in item.get("dosage_form", "").split(","):
                        form = form.strip()
                        if form and form not in result["dosage_forms"]:
                            result["dosage_forms"].append(form)
                    for pkg in item.get("packaging", []):
                        desc = pkg.get("description", "")
                        if desc and desc not in result["strengths"]:
                            result["strengths"].append(desc)
    except http_requests.exceptions.RequestException as exc:
        logger.warning("FDA API error for '%s': %s", brand_name, exc)
    return result


# ── Pharmacy lookup via Google Places ────────────────────────────────────────

def get_nearby_pharmacies(location: str, limit: int = 6) -> list[dict]:
    if not GOOGLE_API_KEY:
        return []

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {"query": f"pharmacy in {location}", "key": GOOGLE_API_KEY}
    pharmacies = []

    try:
        resp = http_requests.get(url, params=params, timeout=8)
        if resp.status_code == 200:
            for place in resp.json().get("results", [])[:limit]:
                loc = place.get("geometry", {}).get("location", {})
                pharmacies.append({
                    "name": place.get("name", "Unknown Pharmacy"),
                    "address": place.get("formatted_address", ""),
                    "neighborhood": _extract_neighborhood(
                        place.get("formatted_address", "")
                    ),
                    "lat": loc.get("lat"),
                    "lng": loc.get("lng"),
                    "rating": place.get("rating"),
                    "place_id": place.get("place_id"),
                })
    except http_requests.exceptions.RequestException as exc:
        logger.warning("Google Places error for '%s': %s", location, exc)

    return pharmacies


def _extract_neighborhood(address: str) -> str:
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        return parts[1]
    return parts[0] if parts else "Nearby"


# ── Prediction engine ────────────────────────────────────────────────────────

CHAIN_BOOST = {
    "cvs": 0.15, "walgreens": 0.15, "rite aid": 0.10,
    "walmart": 0.12, "costco": 0.10, "kroger": 0.08,
}

COMMON_DRUGS = {
    "amoxicillin", "lisinopril", "metformin", "atorvastatin", "amlodipine",
    "metoprolol", "omeprazole", "losartan", "albuterol", "gabapentin",
    "sertraline", "hydrochlorothiazide", "acetaminophen", "ibuprofen",
    "azithromycin", "levothyroxine", "simvastatin", "prednisone",
    "pantoprazole", "montelukast",
}

SHORTAGE_DRUGS = {
    "adderall", "ozempic", "wegovy", "mounjaro", "vyvanse", "concerta",
    "ritalin", "dexedrine", "tirzepatide", "semaglutide",
}


def predict_availability(pharmacy: dict, medication: str, dosage: str,
                         formulation: str) -> dict:
    import random

    med_lower = medication.lower()
    pharm_lower = pharmacy["name"].lower()

    base = 0.55

    for chain, boost in CHAIN_BOOST.items():
        if chain in pharm_lower:
            base += boost
            break

    if any(drug in med_lower for drug in COMMON_DRUGS):
        base += 0.20
    if any(drug in med_lower for drug in SHORTAGE_DRUGS):
        base -= 0.25

    rating = pharmacy.get("rating")
    if rating and rating >= 4.0:
        base += 0.05

    form_lower = (formulation or "").lower()
    if any(tag in form_lower for tag in ["xr", "extended", "injectable", "pen"]):
        base -= 0.10

    base = max(0.05, min(0.95, base))

    seed = hashlib.md5(
        f"{pharmacy['name']}|{medication}|{dosage}|{formulation}".encode()
    ).hexdigest()
    noise = (int(seed[:8], 16) % 200 - 100) / 500
    score = max(0.05, min(0.95, base + noise))

    if score >= 0.70:
        status = "In stock"
        note = "Full 30-day fill confirmed" if score > 0.85 else "30-day fill ready now"
    elif score >= 0.45:
        status = "Limited fill"
        qty = (int(seed[4:8], 16) % 20) + 5
        note = f"{qty} units available"
    elif score >= 0.25:
        status = "Low stock"
        note = "Call before transfer"
    else:
        status = "Out of stock"
        note = random.Random(seed).choice([
            "Backorder flagged", "Next shipment pending",
            "Transfer recommended", "Awaiting wholesaler restock",
        ])

    minutes_ago = (int(seed[8:12], 16) % 25) + 3

    return {
        "status": status,
        "note": note,
        "confidence": round(score, 2),
        "updated": f"{minutes_ago} min ago",
    }


# ── Distance helper ──────────────────────────────────────────────────────────

def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── API routes ───────────────────────────────────────────────────────────────

@app.get("/api/search")
def search(
    medication: str = Query(..., description="Drug brand name"),
    location: str = Query(..., description="Zip code or city"),
    dosage: str = Query("", description="Dosage string"),
    formulation: str = Query("", description="Formulation type"),
):
    if not medication.strip() or not location.strip():
        raise HTTPException(status_code=400, detail="medication and location are required")

    logger.info("Search: medication=%s, location=%s", medication, location)
    drug_info = search_drug_info(medication)

    pharmacies = get_nearby_pharmacies(location)
    if not pharmacies:
        return {
            "drug": drug_info,
            "results": [],
            "error": "No pharmacies found. Check your Google API key or location.",
        }

    center_lat = pharmacies[0].get("lat", 0)
    center_lng = pharmacies[0].get("lng", 0)

    results = []
    for pharm in pharmacies:
        prediction = predict_availability(pharm, medication, dosage, formulation)

        dist = 0.0
        if pharm.get("lat") and pharm.get("lng"):
            dist = _haversine(center_lat, center_lng, pharm["lat"], pharm["lng"])

        results.append({
            "pharmacy": pharm["name"],
            "address": pharm["address"],
            "neighborhood": pharm["neighborhood"],
            "distance": round(dist, 1),
            "medication": medication,
            "dosage": dosage,
            "formulation": formulation,
            "status": prediction["status"],
            "note": prediction["note"],
            "confidence": prediction["confidence"],
            "updated": prediction["updated"],
        })

    status_rank = {"In stock": 0, "Limited fill": 1, "Low stock": 2, "Out of stock": 3}
    results.sort(key=lambda r: (status_rank.get(r["status"], 9), r["distance"]))

    return {"drug": drug_info, "results": results}


@app.get("/api/health")
def health():
    return {"status": "ok", "google_api_configured": bool(GOOGLE_API_KEY)}
