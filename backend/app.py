"""
app.py
FastAPI entry point for Photobooth Digital PCKV backend.
"""
import io
import base64
import time
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core import intensity, frequency, arithmetic, morphology

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Photobooth PCKV API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Filter registry
# ---------------------------------------------------------------------------
FILTER_MAP = {
    "film_negative":          intensity.film_negative,
    "shadow_lift":            intensity.shadow_lift,
    "gamma_transform":        intensity.gamma_transform,
    "contrast_stretch":       intensity.contrast_stretch,
    "histogram_equalization": intensity.histogram_equalization,
    "retro_8bit":             intensity.retro_8bit,
    "spotlight":              intensity.spotlight,
    "dreamy_soft":            frequency.dreamy_soft,
    "ghost_glitch":           frequency.ghost_glitch,
    "butterworth_soft":       frequency.butterworth_soft,
    "detail_pop":             frequency.detail_pop,
    "sketch_edge":            frequency.sketch_edge,
    "fix_backlight":          frequency.fix_backlight,
    "anti_moire":             frequency.anti_moire,
    "vignette":               arithmetic.vignette,
    "double_exposure":        arithmetic.double_exposure,
    "low_light_denoise":      arithmetic.low_light_denoise,
    "masking_stencil":        arithmetic.masking_stencil,
    "spatial_median":         intensity.spatial_median,   # bonus
    "segment_background":     morphology.segment_background,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _decode_image(b64_str: str) -> np.ndarray:
    """Decode a base64 PNG/JPG string to H×W×3 uint8 numpy array."""
    # Strip optional data-URI prefix
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    raw = base64.b64decode(b64_str)
    pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(pil_img, dtype=np.uint8)


def _encode_image(arr: np.ndarray) -> str:
    """Encode H×W×3 uint8 numpy array to base64 PNG string."""
    pil_img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _compute_histogram(arr: np.ndarray) -> List[int]:
    """Return 256-bin luminance histogram of an H×W×3 image."""
    gray = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]).astype(np.uint8)
    hist, _ = np.histogram(gray.ravel(), bins=256, range=(0, 255))
    return hist.tolist()


def _apply_filter(img: np.ndarray, filter_type: str, params: dict) -> np.ndarray:
    fn = FILTER_MAP.get(filter_type)
    if fn is None:
        raise HTTPException(status_code=400, detail=f"Unknown filter: {filter_type}")
    return fn(img, params)


def _build_analysis_response(original: np.ndarray, result: np.ndarray, return_analysis: bool):
    spectrum_b64 = None
    hist_original = None
    hist_filtered = None
    if return_analysis:
        spectrum_b64 = frequency.compute_spectrum(result)
        hist_original = _compute_histogram(original)
        hist_filtered = _compute_histogram(result)
    return spectrum_b64, hist_original, hist_filtered


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class FilterApplyRequest(BaseModel):
    image: str
    filter_type: str
    params: Dict[str, Any] = {}
    return_analysis: bool = False


class FilterChainRequest(BaseModel):
    image: str
    filters: List[Dict[str, Any]]
    return_analysis: bool = False


class AnalysisRequest(BaseModel):
    image: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/filter/apply")
def filter_apply(req: FilterApplyRequest):
    t0 = time.perf_counter()
    try:
        original = _decode_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    result = _apply_filter(original, req.filter_type, req.params)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    spectrum_b64, hist_orig, hist_filt = _build_analysis_response(
        original, result, req.return_analysis
    )

    return {
        "status": "success",
        "result_image": _encode_image(result),
        "spectrum_image": spectrum_b64,
        "histogram_data": {
            "original": hist_orig,
            "filtered": hist_filt,
        },
        "execution_time_ms": round(elapsed_ms, 3),
    }


@app.post("/api/filter/chain")
def filter_chain(req: FilterChainRequest):
    t0 = time.perf_counter()
    try:
        original = _decode_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    result = original.copy()
    for step in req.filters:
        ftype = step.get("type", "")
        fparams = step.get("params", {})
        result = _apply_filter(result, ftype, fparams)

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    spectrum_b64, hist_orig, hist_filt = _build_analysis_response(
        original, result, req.return_analysis
    )

    return {
        "status": "success",
        "result_image": _encode_image(result),
        "spectrum_image": spectrum_b64,
        "histogram_data": {
            "original": hist_orig,
            "filtered": hist_filt,
        },
        "execution_time_ms": round(elapsed_ms, 3),
    }


@app.post("/api/analysis")
def analysis(req: AnalysisRequest):
    try:
        img = _decode_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    hist = _compute_histogram(img)
    spectrum_b64 = frequency.compute_spectrum(img)

    return {
        "histogram": hist,
        "spectrum_image": spectrum_b64,
    }
