"""CivicFix AI service: classify a civic-issue photo, estimate severity, draft a report.

Providers (first available wins):
  1. Claude vision   -> set ANTHROPIC_API_KEY   (fast, best quality, also writes the summary)
  2. CLIP zero-shot  -> set USE_CLIP=1          (offline, needs requirements-clip.txt)
  3. Safe fallback   -> generic draft, user fixes the category manually
"""
import base64, io, json, os, re, time

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

CATEGORIES = ["pothole", "streetlight", "garbage", "water_leak", "road_damage", "other"]
LABELS = {
    "pothole": "Pothole", "streetlight": "Broken streetlight", "garbage": "Garbage or illegal dumping",
    "water_leak": "Water leak", "road_damage": "Damaged road or pavement", "other": "Other issue",
}
API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("AI_MODEL", "claude-haiku-4-5-20251001")
USE_CLIP = os.getenv("USE_CLIP", "0") == "1"

app = FastAPI(title="CivicFix AI Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PROMPT = f"""You triage photos of public infrastructure problems for a city maintenance team.
Look at the photo and answer with ONLY a JSON object, no markdown:
{{"category": one of {CATEGORIES},
 "confidence": number 0-1,
 "severity": integer 1-10 (10 = immediate danger to people, e.g. deep pothole in traffic lane, live wire, major flooding),
 "near_public_zone": true if a school, hospital, crossing, market, bus stop or busy road is visible,
 "title": "max 8 words, plain language",
 "description": "2 factual sentences: what is wrong, how big, any hazard",
 "details": ["up to 4 short observations useful for a repair crew, e.g. approx size, surface, blocked lane"]}}
If the photo does not show a public-infrastructure issue use category "other" and confidence below 0.4."""


def shrink(raw: bytes, max_side: int = 1024) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80)
    return out.getvalue()


def clean(d: dict) -> dict:
    cat = d.get("category") if d.get("category") in CATEGORIES else "other"
    try:
        sev = max(1, min(10, int(round(float(d.get("severity", 5))))))
    except Exception:
        sev = 5
    try:
        conf = max(0.0, min(1.0, float(d.get("confidence", 0.5))))
    except Exception:
        conf = 0.5
    return {
        "category": cat,
        "confidence": round(conf, 2),
        "severity": sev,
        "near_public_zone": bool(d.get("near_public_zone", False)),
        "title": str(d.get("title") or LABELS[cat])[:90],
        "description": str(d.get("description") or "")[:500],
        "details": [str(x)[:120] for x in (d.get("details") or [])][:4],
    }


async def claude_analyze(jpeg: bytes) -> dict:
    body = {
        "model": MODEL, "max_tokens": 450,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                         "data": base64.b64encode(jpeg).decode()}},
            {"type": "text", "text": PROMPT}]}],
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("https://api.anthropic.com/v1/messages", json=body, headers={
            "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    r.raise_for_status()
    text = "".join(b.get("text", "") for b in r.json()["content"])
    match = re.search(r"\{.*\}", text, re.S)
    return clean(json.loads(match.group(0)))


_clip = None
CLIP_PROMPTS = {
    "pothole": "a photo of a pothole in a road", "streetlight": "a photo of a broken or dark street light pole",
    "garbage": "a photo of garbage or illegal dumping on a street", "water_leak": "a photo of a water leak or burst pipe flooding a street",
    "road_damage": "a photo of cracked or damaged road pavement", "other": "a photo of an ordinary street scene",
}
BASE_SEVERITY = {"pothole": 6, "streetlight": 5, "garbage": 4, "water_leak": 7, "road_damage": 6, "other": 3}


def clip_analyze(jpeg: bytes) -> dict:
    global _clip
    import torch
    from transformers import CLIPModel, CLIPProcessor
    if _clip is None:
        _clip = (CLIPModel.from_pretrained("openai/clip-vit-base-patch32"),
                 CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32"))
    model, proc = _clip
    keys = list(CLIP_PROMPTS)
    inputs = proc(text=[CLIP_PROMPTS[k] for k in keys], images=Image.open(io.BytesIO(jpeg)), return_tensors="pt", padding=True)
    with torch.no_grad():
        probs = model(**inputs).logits_per_image.softmax(dim=1)[0]
    i = int(probs.argmax())
    cat, conf = keys[i], float(probs[i])
    return clean({"category": cat, "confidence": conf, "severity": BASE_SEVERITY[cat],
                  "title": LABELS[cat], "description": f"Automatic detection suggests: {LABELS[cat].lower()}. Please add details."})


def fallback() -> dict:
    return clean({"category": "other", "confidence": 0.0, "severity": 5, "title": "Reported issue",
                  "description": "Automatic analysis is unavailable. Please pick a category and describe the problem."})


@app.get("/health")
def health():
    return {"ok": True, "provider": "claude" if API_KEY else "clip" if USE_CLIP else "fallback"}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    started = time.perf_counter()
    try:
        jpeg = shrink(await image.read())
    except Exception:
        raise HTTPException(400, "Not a valid image")
    provider, result = "fallback", None
    try:
        if API_KEY:
            provider, result = "claude", await claude_analyze(jpeg)
        elif USE_CLIP:
            provider, result = "clip", clip_analyze(jpeg)
    except Exception as e:  # never block a citizen from reporting
        print("analysis failed:", repr(e))
    result = result or fallback()
    result.update(provider=provider, latency_ms=int((time.perf_counter() - started) * 1000))
    return result
