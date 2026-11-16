"""
core/arithmetic.py
Bab 2: Arithmetic / logical image operations (numpy + Pillow only).
"""
import io
import numpy as np
from PIL import Image, ImageFilter


# ---------------------------------------------------------------------------
# 15. Vignette
# ---------------------------------------------------------------------------
def vignette(img: np.ndarray, params: dict) -> np.ndarray:
    """
    M = exp(-(dx^2 + dy^2) / (2*sigma^2)) normalised to [0,1] from centre.
    result = img * M
    """
    sigma = float(params.get("sigma", 0.5))
    H, W = img.shape[:2]

    # Normalised coordinates [-1, 1]
    xs = np.linspace(-1, 1, H)
    ys = np.linspace(-1, 1, W)
    dx, dy = np.meshgrid(xs, ys, indexing="ij")

    M = np.exp(-(dx ** 2 + dy ** 2) / (2.0 * sigma ** 2))
    M = M / M.max()  # normalise to [0,1]

    result = img.astype(np.float64) * M[..., np.newaxis]
    return np.clip(result, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 16. Double exposure
# ---------------------------------------------------------------------------
def double_exposure(img: np.ndarray, params: dict) -> np.ndarray:
    """
    texture = synthetic gradient or noise.
    g = alpha * img + (1 - alpha) * texture
    """
    alpha = float(params.get("alpha", 0.5))
    texture_type = str(params.get("texture_type", "gradient"))

    H, W = img.shape[:2]

    if texture_type == "noise":
        rng = np.random.default_rng(seed=42)
        texture = rng.integers(0, 256, size=(H, W, 3), dtype=np.uint8).astype(np.float64)
    else:  # gradient
        xs = np.linspace(0, 255, W)
        ys = np.linspace(0, 255, H)
        gx, gy = np.meshgrid(xs, ys)  # H×W
        # Three-channel gradient: R=gx, G=gy, B=128
        texture = np.stack([gx, gy, np.full((H, W), 128.0)], axis=-1)

    result = alpha * img.astype(np.float64) + (1.0 - alpha) * texture
    return np.clip(result, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 17. Low-light denoise (averaging)
# ---------------------------------------------------------------------------
def low_light_denoise(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Add Gaussian noise to n_frames copies, then average.
    Simulates multi-frame averaging denoising.
    """
    n_frames = int(params.get("n_frames", 4))
    noise_std = float(params.get("noise_std", 20))
    n_frames = max(1, n_frames)

    rng = np.random.default_rng(seed=0)
    img_f = img.astype(np.float64)
    accumulator = np.zeros_like(img_f)

    for _ in range(n_frames):
        noise = rng.normal(0, noise_std, size=img_f.shape)
        frame = img_f + noise
        accumulator += frame

    averaged = accumulator / n_frames
    return np.clip(np.round(averaged), 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 18. Masking stencil
# ---------------------------------------------------------------------------
def _gaussian_blur_1d(arr: np.ndarray, sigma: float) -> np.ndarray:
    """Simple 1D Gaussian blur via repeated box-filter passes (numpy only)."""
    if sigma <= 0:
        return arr
    radius = int(round(3 * sigma))
    if radius == 0:
        return arr
    kernel_size = 2 * radius + 1
    kernel = np.exp(-0.5 * ((np.arange(kernel_size) - radius) / sigma) ** 2)
    kernel /= kernel.sum()
    return np.convolve(arr, kernel, mode="same")


def _make_mask(shape_name: str, H: int, W: int) -> np.ndarray:
    """Return a float [0,1] mask of given shape."""
    xs = np.linspace(-1, 1, H)
    ys = np.linspace(-1, 1, W)
    dx, dy = np.meshgrid(xs, ys, indexing="ij")

    if shape_name == "circle":
        mask = (dx ** 2 + dy ** 2 <= 1.0).astype(np.float64)
    elif shape_name == "square":
        mask = ((np.abs(dx) <= 0.85) & (np.abs(dy) <= 0.85)).astype(np.float64)
    elif shape_name == "heart":
        # Heart curve approximation
        x = dx * 1.2
        y = dy * -1.2
        mask = ((x ** 2 + (y - np.sqrt(np.abs(x))) ** 2) <= 1.0).astype(np.float64)
    else:
        mask = np.ones((H, W), dtype=np.float64)

    return mask


def _feather_mask(mask: np.ndarray, feather: int) -> np.ndarray:
    """Apply Gaussian feathering to mask edges (row-wise then col-wise)."""
    if feather <= 0:
        return mask
    sigma = feather / 3.0
    # Row-wise
    out = np.apply_along_axis(_gaussian_blur_1d, 1, mask.astype(np.float64), sigma)
    # Col-wise
    out = np.apply_along_axis(_gaussian_blur_1d, 0, out, sigma)
    return np.clip(out, 0.0, 1.0)


def masking_stencil(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Create binary mask of given shape, feather it, then AND with image
    (blacken area outside mask).
    """
    shape = str(params.get("shape", "circle"))
    feather = int(params.get("feather", 5))

    H, W = img.shape[:2]
    mask = _make_mask(shape, H, W)
    mask = _feather_mask(mask, feather)

    result = img.astype(np.float64) * mask[..., np.newaxis]
    return np.clip(result, 0, 255).astype(np.uint8)
