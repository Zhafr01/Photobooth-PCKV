"""
core/intensity.py
Bab 3: Intensity transformations (all numpy+Pillow only, no scipy/cv2/skimage).
All public functions signature: (img: np.ndarray uint8 H×W×3, params: dict) -> np.ndarray uint8 H×W×3
"""
import numpy as np
from core.color import rgb_to_ycbcr, ycbcr_to_rgb


# ---------------------------------------------------------------------------
# Helper: replace Y channel and reconstruct RGB
# ---------------------------------------------------------------------------
def _apply_on_Y(img_rgb: np.ndarray, Y_new: np.ndarray) -> np.ndarray:
    _, Cb, Cr = rgb_to_ycbcr(img_rgb)
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# 1. Film negative
# ---------------------------------------------------------------------------
def film_negative(img: np.ndarray, params: dict) -> np.ndarray:
    """s = 255 - r applied directly on each RGB channel."""
    return (255 - img.astype(np.int16)).clip(0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 2. Shadow lift (log transform)
# ---------------------------------------------------------------------------
def shadow_lift(img: np.ndarray, params: dict) -> np.ndarray:
    """s = c * log(1 + r) on Y channel.  c = 255 / log(256)"""
    Y, Cb, Cr = rgb_to_ycbcr(img)
    c = 255.0 / np.log(256.0)
    Y_new = c * np.log1p(Y)
    Y_new = np.clip(Y_new, 16, 235)
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# 3. Gamma transform
# ---------------------------------------------------------------------------
def gamma_transform(img: np.ndarray, params: dict) -> np.ndarray:
    """s = 255 * (r/255)^gamma on Y channel."""
    gamma = float(params.get("gamma", 1.0))
    Y, Cb, Cr = rgb_to_ycbcr(img)
    # Normalise Y (16-235 range) to 0-1
    Y_norm = (Y - 16.0) / 219.0
    Y_norm = np.clip(Y_norm, 0.0, 1.0)
    Y_new = 219.0 * np.power(Y_norm, gamma) + 16.0
    Y_new = np.clip(Y_new, 16, 235)
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# 4. Contrast stretch (piecewise-linear)
# ---------------------------------------------------------------------------
def contrast_stretch(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Piecewise-linear 3-segment on Y channel through (r1,s1) and (r2,s2).
    Default params: r1=64, s1=0, r2=192, s2=255
    """
    r1 = float(params.get("r1", 64))
    s1 = float(params.get("s1", 0))
    r2 = float(params.get("r2", 192))
    s2 = float(params.get("s2", 255))

    Y, Cb, Cr = rgb_to_ycbcr(img)
    # Map Y (16-235) to 0-255 for computation
    Y_in = np.clip((Y - 16.0) * 255.0 / 219.0, 0.0, 255.0)

    Y_out = np.zeros_like(Y_in)

    # Segment 1: [0, r1] -> [0, s1]
    if r1 > 0:
        slope1 = s1 / r1
    else:
        slope1 = 0.0
    mask1 = Y_in <= r1
    Y_out[mask1] = slope1 * Y_in[mask1]

    # Segment 2: [r1, r2] -> [s1, s2]
    if r2 != r1:
        slope2 = (s2 - s1) / (r2 - r1)
    else:
        slope2 = 0.0
    mask2 = (Y_in > r1) & (Y_in <= r2)
    Y_out[mask2] = s1 + slope2 * (Y_in[mask2] - r1)

    # Segment 3: [r2, 255] -> [s2, 255]
    if 255.0 - r2 > 0:
        slope3 = (255.0 - s2) / (255.0 - r2)
    else:
        slope3 = 0.0
    mask3 = Y_in > r2
    Y_out[mask3] = s2 + slope3 * (Y_in[mask3] - r2)

    Y_out = np.clip(Y_out, 0, 255)
    # Map back to YCbCr range
    Y_new = Y_out * 219.0 / 255.0 + 16.0
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# 5. Histogram equalization
# ---------------------------------------------------------------------------
def histogram_equalization(img: np.ndarray, params: dict) -> np.ndarray:
    """
    s = (L-1) * CDF(r) on Y channel.
    out = blend * equalized + (1-blend) * original.
    """
    blend = float(params.get("blend", 1.0))
    Y, Cb, Cr = rgb_to_ycbcr(img)
    Y_int = np.clip(Y - 16.0, 0, 219) * 255.0 / 219.0
    Y_int = np.round(Y_int).astype(np.int32)

    # Build histogram and CDF on 0-255 range
    hist, _ = np.histogram(Y_int.ravel(), bins=256, range=(0, 255))
    cdf = hist.cumsum().astype(np.float64)
    cdf_min = cdf[cdf > 0].min()
    total = Y_int.size
    # CDF normalised mapping
    lut = np.round(255.0 * (cdf - cdf_min) / (total - cdf_min)).astype(np.float64)
    lut = np.clip(lut, 0, 255)

    Y_eq = lut[Y_int]
    # Blend
    Y_blended = blend * Y_eq + (1.0 - blend) * Y_int.astype(np.float64)
    # Map back
    Y_new = Y_blended * 219.0 / 255.0 + 16.0
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# 6. Retro 8-bit (bit masking)
# ---------------------------------------------------------------------------
def retro_8bit(img: np.ndarray, params: dict) -> np.ndarray:
    """
    mask = ~((1 << (8-k)) - 1) & 0xFF
    s = r & mask  applied per RGB channel.
    """
    k = int(params.get("k", 4))
    k = max(1, min(8, k))
    mask = (~((1 << (8 - k)) - 1)) & 0xFF
    return (img & mask).astype(np.uint8)


# ---------------------------------------------------------------------------
# 7. Spotlight (intensity slicing)
# ---------------------------------------------------------------------------
def spotlight(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Pixels with Y in [low, high] are kept; others are multiplied by dim_factor.
    """
    low = float(params.get("low", 100))
    high = float(params.get("high", 200))
    dim_factor = float(params.get("dim_factor", 0.1))

    Y, Cb, Cr = rgb_to_ycbcr(img)
    Y_norm = np.clip((Y - 16.0) * 255.0 / 219.0, 0.0, 255.0)

    dim_mask = (Y_norm < low) | (Y_norm > high)
    Y_new = Y_norm.copy()
    Y_new[dim_mask] = Y_norm[dim_mask] * dim_factor
    Y_new = np.clip(Y_new, 0, 255)
    Y_out = Y_new * 219.0 / 255.0 + 16.0
    return ycbcr_to_rgb(Y_out, Cb, Cr)


# ---------------------------------------------------------------------------
# BONUS: Spatial median filter (3×3)
# ---------------------------------------------------------------------------
def spatial_median(img: np.ndarray, params: dict) -> np.ndarray:
    """
    3×3 median filter applied per channel using sliding window (pure numpy).
    """
    ksize = int(params.get("ksize", 3))
    ksize = max(1, ksize | 1)  # ensure odd
    pad = ksize // 2

    h, w, c = img.shape
    result = np.zeros_like(img)
    img_f = img.astype(np.float32)

    for ch in range(c):
        chan = img_f[..., ch]
        padded = np.pad(chan, pad, mode="reflect")
        # Build sliding window view using stride tricks
        shape = (h, w, ksize, ksize)
        strides = (padded.strides[0], padded.strides[1],
                   padded.strides[0], padded.strides[1])
        windows = np.lib.stride_tricks.as_strided(padded, shape=shape, strides=strides)
        result[..., ch] = np.median(windows.reshape(h, w, -1), axis=-1)

    return result.astype(np.uint8)
