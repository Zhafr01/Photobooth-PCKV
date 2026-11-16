"""
core/frequency.py
Bab 4: FFT-based frequency domain filters (numpy + Pillow only).
"""
import io
import base64
import numpy as np
from PIL import Image
from core.color import rgb_to_ycbcr, ycbcr_to_rgb


# ---------------------------------------------------------------------------
# Utility: next power of 2
# ---------------------------------------------------------------------------
def _next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p <<= 1
    return p


# ---------------------------------------------------------------------------
# Core frequency-domain engine
# ---------------------------------------------------------------------------
def apply_frequency_filter(img_rgb: np.ndarray, make_H, params: dict) -> np.ndarray:
    """
    1. Convert to YCbCr, extract Y (float64)
    2. Pad to next power-of-2 >= 2M-1 and 2N-1
    3. Checkerboard centering
    4. FFT2
    5. Build normalised distance grid D (0–1) from centre
    6. H = make_H(D, params)
    7. IFFT2, undo centering, take real part
    8. Crop to M×N, clip 0-255
    9. Reconstruct RGB
    """
    M, N = img_rgb.shape[:2]
    Y, Cb, Cr = rgb_to_ycbcr(img_rgb)
    Y_f = Y.astype(np.float64)

    # Pad
    P = _next_pow2(max(2 * M - 1, M + 1))
    Q = _next_pow2(max(2 * N - 1, N + 1))

    # Checkerboard kernel
    xs = np.arange(M)
    ys = np.arange(N)
    checker = ((-1) ** (xs[:, None] + ys[None, :])).astype(np.float64)

    Y_cent = Y_f * checker
    Y_pad = np.zeros((P, Q), dtype=np.float64)
    Y_pad[:M, :N] = Y_cent

    # FFT
    F = np.fft.fft2(Y_pad)

    # Distance grid (normalised 0-1 from centre of padded image)
    u = np.fft.fftfreq(P)  # -0.5..0.5
    v = np.fft.fftfreq(Q)
    U, V = np.meshgrid(u, v, indexing="ij")
    D = np.sqrt(U ** 2 + V ** 2) * np.sqrt(2)  # scale so max ~1
    # Normalise: max distance from centre is sqrt(0.5^2+0.5^2)=0.7071
    D = D / (np.sqrt(0.5 ** 2 + 0.5 ** 2))
    D = np.clip(D, 0.0, None)

    # Build filter
    H = make_H(D, params)

    # Apply
    G = F * H
    g_pad = np.fft.ifft2(G).real

    # Undo checkerboard
    g_crop = g_pad[:M, :N]
    checker_full = ((-1) ** (xs[:, None] + ys[None, :])).astype(np.float64)
    g_crop = g_crop * checker_full

    # Clip back to YCbCr Y range
    Y_new = np.clip(g_crop, 16, 235)
    return ycbcr_to_rgb(Y_new, Cb, Cr)


# ---------------------------------------------------------------------------
# Spectrum computation
# ---------------------------------------------------------------------------
def compute_spectrum(img_rgb: np.ndarray) -> str:
    """
    Compute log-magnitude spectrum of Y channel.
    Returns base64-encoded PNG string.
    """
    Y, _, _ = rgb_to_ycbcr(img_rgb)
    M, N = Y.shape

    P = _next_pow2(max(2 * M - 1, M + 1))
    Q = _next_pow2(max(2 * N - 1, N + 1))

    xs = np.arange(M)
    ys = np.arange(N)
    checker = ((-1) ** (xs[:, None] + ys[None, :])).astype(np.float64)

    Y_pad = np.zeros((P, Q))
    Y_pad[:M, :N] = Y.astype(np.float64) * checker

    F = np.fft.fft2(Y_pad)
    mag = np.abs(F[:M, :N])

    c = 255.0 / np.log(1.0 + mag.max()) if mag.max() > 0 else 1.0
    S = c * np.log1p(mag)
    S = np.clip(S, 0, 255).astype(np.uint8)

    pil_img = Image.fromarray(S, mode="L")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ---------------------------------------------------------------------------
# Individual filter functions
# ---------------------------------------------------------------------------

def dreamy_soft(img: np.ndarray, params: dict) -> np.ndarray:
    """GLPF: H = exp(-D^2 / (2 * d0^2))"""
    d0 = float(params.get("d0", 0.1))

    def make_H(D, p):
        return np.exp(-D ** 2 / (2 * d0 ** 2))

    return apply_frequency_filter(img, make_H, params)


def ghost_glitch(img: np.ndarray, params: dict) -> np.ndarray:
    """ILPF: H = 1 if D <= d0 else 0"""
    d0 = float(params.get("d0", 0.1))

    def make_H(D, p):
        return (D <= d0).astype(np.float64)

    return apply_frequency_filter(img, make_H, params)


def butterworth_soft(img: np.ndarray, params: dict) -> np.ndarray:
    """BLPF: H = 1 / (1 + (D/d0)^(2n))"""
    d0 = float(params.get("d0", 0.1))
    n = float(params.get("n", 2))

    def make_H(D, p):
        with np.errstate(divide="ignore", invalid="ignore"):
            H = 1.0 / (1.0 + np.where(D == 0, 0.0, (D / d0) ** (2 * n)))
        H[D == 0] = 1.0
        return H

    return apply_frequency_filter(img, make_H, params)


def detail_pop(img: np.ndarray, params: dict) -> np.ndarray:
    """High-boost: H = k1 + k2 * (1 - GLPF(d0))"""
    d0 = float(params.get("d0", 0.1))
    k1 = float(params.get("k1", 1.0))
    k2 = float(params.get("k2", 1.5))

    def make_H(D, p):
        glpf = np.exp(-D ** 2 / (2 * d0 ** 2))
        return k1 + k2 * (1.0 - glpf)

    return apply_frequency_filter(img, make_H, params)


def sketch_edge(img: np.ndarray, params: dict) -> np.ndarray:
    """GHPF: H = 1 - exp(-D^2 / (2*d0^2))"""
    d0 = float(params.get("d0", 0.1))

    def make_H(D, p):
        return 1.0 - np.exp(-D ** 2 / (2 * d0 ** 2))

    return apply_frequency_filter(img, make_H, params)


def fix_backlight(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Homomorphic filter:
    ln(Y+1) -> FFT -> H=(gh-gl)*(1-GLPF)+gl -> IFFT -> exp-1
    """
    d0 = float(params.get("d0", 0.1))
    gl = float(params.get("gl", 0.5))
    gh = float(params.get("gh", 2.0))

    M, N = img.shape[:2]
    Y, Cb, Cr = rgb_to_ycbcr(img)
    Y_f = np.clip(Y.astype(np.float64), 16, 235)

    # Log
    Y_log = np.log1p(Y_f)

    P = _next_pow2(max(2 * M - 1, M + 1))
    Q = _next_pow2(max(2 * N - 1, N + 1))

    xs = np.arange(M)
    ys = np.arange(N)
    checker = ((-1) ** (xs[:, None] + ys[None, :])).astype(np.float64)

    Y_pad = np.zeros((P, Q))
    Y_pad[:M, :N] = Y_log * checker

    F = np.fft.fft2(Y_pad)

    u = np.fft.fftfreq(P)
    v = np.fft.fftfreq(Q)
    U, V = np.meshgrid(u, v, indexing="ij")
    D = np.sqrt(U ** 2 + V ** 2) / (np.sqrt(0.5 ** 2 + 0.5 ** 2))

    glpf = np.exp(-D ** 2 / (2 * d0 ** 2))
    H = (gh - gl) * (1.0 - glpf) + gl

    G = F * H
    g_pad = np.fft.ifft2(G).real
    g_crop = g_pad[:M, :N] * checker

    # Exp inverse of log
    Y_new = np.expm1(g_crop)
    Y_new = np.clip(Y_new, 16, 235)
    return ycbcr_to_rgb(Y_new, Cb, Cr)


def anti_moire(img: np.ndarray, params: dict) -> np.ndarray:
    """
    Notch reject filter: H=1 everywhere except circles at (u0,v0) and
    its conjugate-symmetric pair (P-u0, Q-v0).
    """
    u0_norm = float(params.get("u0_norm", 0.3))
    v0_norm = float(params.get("v0_norm", 0.0))
    r_norm = float(params.get("r_norm", 0.05))

    M, N = img.shape[:2]
    Y, Cb, Cr = rgb_to_ycbcr(img)
    Y_f = Y.astype(np.float64)

    P = _next_pow2(max(2 * M - 1, M + 1))
    Q = _next_pow2(max(2 * N - 1, N + 1))

    xs = np.arange(M)
    ys = np.arange(N)
    checker = ((-1) ** (xs[:, None] + ys[None, :])).astype(np.float64)

    Y_pad = np.zeros((P, Q))
    Y_pad[:M, :N] = Y_f * checker

    F = np.fft.fft2(Y_pad)

    # Notch centres in pixel coordinates of padded image
    u0 = int(round(u0_norm * P))
    v0 = int(round(v0_norm * Q))
    r_px_u = int(round(r_norm * P))
    r_px_v = int(round(r_norm * Q))
    r_px = max(r_px_u, r_px_v, 1)

    # Build coordinate grids
    uu = np.arange(P)
    vv = np.arange(Q)
    UU, VV = np.meshgrid(uu, vv, indexing="ij")

    H = np.ones((P, Q), dtype=np.float64)

    def _notch_circle(cx, cy):
        dist2 = (UU - cx) ** 2 + (VV - cy) ** 2
        H[dist2 <= r_px ** 2] = 0.0

    _notch_circle(u0, v0)
    _notch_circle(P - u0, Q - v0)

    G = F * H
    g_pad = np.fft.ifft2(G).real
    g_crop = g_pad[:M, :N] * checker

    Y_new = np.clip(g_crop, 16, 235)
    return ycbcr_to_rgb(Y_new, Cb, Cr)
