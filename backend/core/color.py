"""
core/color.py
RGB <-> YCbCr conversion (ITU-R BT.601)
"""
import numpy as np


def rgb_to_ycbcr(img_rgb: np.ndarray):
    """
    Convert H×W×3 uint8 RGB image to (Y, Cb, Cr) float arrays.
    Returns three float64 arrays each of shape H×W.
    """
    img = img_rgb.astype(np.float64)
    R = img[..., 0]
    G = img[..., 1]
    B = img[..., 2]

    Y  =  16.0 + 65.481 * R / 255.0 + 128.553 * G / 255.0 + 24.966 * B / 255.0
    Cb = 128.0 - 37.797 * R / 255.0 -  74.203 * G / 255.0 + 112.0  * B / 255.0
    Cr = 128.0 + 112.0  * R / 255.0 -  93.786 * G / 255.0 - 18.214 * B / 255.0

    return Y, Cb, Cr


def ycbcr_to_rgb(Y: np.ndarray, Cb: np.ndarray, Cr: np.ndarray) -> np.ndarray:
    """
    Convert (Y, Cb, Cr) float arrays to H×W×3 uint8 RGB image.
    """
    Y  = Y.astype(np.float64)
    Cb = Cb.astype(np.float64)
    Cr = Cr.astype(np.float64)

    R = 298.082 * (Y - 16) / 256.0 + 408.583 * (Cr - 128) / 256.0
    G = 298.082 * (Y - 16) / 256.0 - 100.291 * (Cb - 128) / 256.0 - 208.120 * (Cr - 128) / 256.0
    B = 298.082 * (Y - 16) / 256.0 + 516.412 * (Cb - 128) / 256.0

    img = np.stack([R, G, B], axis=-1)
    img = np.clip(np.round(img), 0, 255).astype(np.uint8)
    return img
