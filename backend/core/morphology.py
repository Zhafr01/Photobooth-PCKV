"""
core/morphology.py
Bab 9 & 10: Thresholding and morphological operations (numpy + Pillow only).
"""
import numpy as np


# ---------------------------------------------------------------------------
# Otsu's threshold
# ---------------------------------------------------------------------------
def otsu_threshold(img_gray: np.ndarray):
    """
    Compute Otsu's threshold on a grayscale image.
    Returns (threshold: int, binary_mask: np.ndarray bool H×W)
    where binary_mask is True for foreground (> threshold).
    """
    img_gray = img_gray.astype(np.uint8)
    hist, _ = np.histogram(img_gray.ravel(), bins=256, range=(0, 255))
    total = img_gray.size

    best_thresh = 0
    best_variance = -1.0
    sum_total = np.dot(np.arange(256, dtype=np.float64), hist)

    w0 = 0.0
    sum0 = 0.0

    for t in range(256):
        w0 += hist[t]
        if w0 == 0:
            continue
        w1 = total - w0
        if w1 == 0:
            break
        sum0 += t * hist[t]
        mu0 = sum0 / w0
        mu1 = (sum_total - sum0) / w1
        variance = w0 * w1 * (mu0 - mu1) ** 2
        if variance > best_variance:
            best_variance = variance
            best_thresh = t

    binary_mask = img_gray > best_thresh
    return best_thresh, binary_mask


# ---------------------------------------------------------------------------
# Morphological primitives (square structuring element, pure numpy)
# ---------------------------------------------------------------------------
def morph_erode(mask: np.ndarray, k: int) -> np.ndarray:
    """Erosion with k×k square SE."""
    k = max(1, k | 1)  # ensure odd
    pad = k // 2
    mask_uint = mask.astype(np.uint8)
    H, W = mask_uint.shape
    padded = np.pad(mask_uint, pad, mode="constant", constant_values=1)

    shape = (H, W, k, k)
    strides = (padded.strides[0], padded.strides[1],
               padded.strides[0], padded.strides[1])
    windows = np.lib.stride_tricks.as_strided(padded, shape=shape, strides=strides)
    return (windows.reshape(H, W, -1).min(axis=-1)).astype(bool)


def morph_dilate(mask: np.ndarray, k: int) -> np.ndarray:
    """Dilation with k×k square SE."""
    k = max(1, k | 1)
    pad = k // 2
    mask_uint = mask.astype(np.uint8)
    H, W = mask_uint.shape
    padded = np.pad(mask_uint, pad, mode="constant", constant_values=0)

    shape = (H, W, k, k)
    strides = (padded.strides[0], padded.strides[1],
               padded.strides[0], padded.strides[1])
    windows = np.lib.stride_tricks.as_strided(padded, shape=shape, strides=strides)
    return (windows.reshape(H, W, -1).max(axis=-1)).astype(bool)


def morph_open(mask: np.ndarray, k: int) -> np.ndarray:
    """Opening: erode then dilate."""
    return morph_dilate(morph_erode(mask, k), k)


def morph_close(mask: np.ndarray, k: int) -> np.ndarray:
    """Closing: dilate then erode."""
    return morph_erode(morph_dilate(mask, k), k)


# ---------------------------------------------------------------------------
# Background segmentation
# ---------------------------------------------------------------------------
def segment_background(img_rgb: np.ndarray, params: dict) -> np.ndarray:
    """
    Segment foreground using Otsu on grayscale, then morph open+close to clean
    up mask, then replace background with bg_color.
    params:
        bg_color: list[int]  [R, G, B], default [255, 255, 255]
        kernel_size: int     morphological kernel size, default 5
    """
    bg_color = params.get("bg_color", [255, 255, 255])
    kernel_size = int(params.get("kernel_size", 5))
    kernel_size = max(1, kernel_size | 1)

    # Convert to grayscale (luminance)
    R = img_rgb[..., 0].astype(np.float64)
    G = img_rgb[..., 1].astype(np.float64)
    B = img_rgb[..., 2].astype(np.float64)
    gray = (0.299 * R + 0.587 * G + 0.114 * B).astype(np.uint8)

    _, fg_mask = otsu_threshold(gray)

    # Morphological cleaning
    fg_mask = morph_open(fg_mask, kernel_size)
    fg_mask = morph_close(fg_mask, kernel_size)

    result = img_rgb.copy()
    bg = np.array(bg_color, dtype=np.uint8)
    result[~fg_mask] = bg

    return result
