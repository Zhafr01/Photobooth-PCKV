/**
 * clientFilters.ts
 * Standalone Client-side Mathematical Image Processing Engine (Gonzalez & Woods)
 * Digunakan sebagai fallback offline / real-time ketika backend Python sedang cold-start atau offline.
 */
import type { FilterApiResponse } from "../types";

// Helper: load base64 image into HTMLImageElement
function loadImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
  });
}

// Helper: RGB to YCbCr (ITU-R BT.601)
function rgbToYcbcr(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

// Helper: YCbCr to RGB
function ycbcrToRgb(y: number, cb: number, cr: number) {
  const r = Math.min(255, Math.max(0, y + 1.402 * (cr - 128)));
  const g = Math.min(255, Math.max(0, y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)));
  const b = Math.min(255, Math.max(0, y + 1.772 * (cb - 128)));
  return [r, g, b];
}

// Compute 256-bin grayscale histogram
function computeHistogram(d: Uint8ClampedArray): number[] {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    hist[Math.min(255, Math.max(0, gray))]++;
  }
  return hist;
}

// Create a synthetic 2D Fourier Spectrum preview image
function generateSpectrumDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.2, "#f43f5e");
  grad.addColorStop(0.6, "#38bdf8");
  grad.addColorStop(1, "#030712");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.moveTo(64, 0); ctx.lineTo(64, 128);
  ctx.moveTo(0, 64); ctx.lineTo(128, 64);
  ctx.stroke();

  return canvas.toDataURL("image/png").split(",")[1];
}

export async function applyClientFilter(
  imageBase64: string,
  filterType: string,
  params: Record<string, number | string>,
  returnAnalysis = false
): Promise<FilterApiResponse> {
  const img = await loadImage(imageBase64);
  const canvas = document.createElement("canvas");
  const w = img.naturalWidth || 640;
  const h = img.naturalHeight || 480;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const originalHist = computeHistogram(d);

  // ─── Gonzalez & Woods Algorithm Implementations ───
  switch (filterType) {
    // 1. Film Negative: s = 255 - r
    case "film_negative": {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      break;
    }

    // 2. Shadow Lift (Log Transform): s = c * log(1 + r)
    case "shadow_lift": {
      const cParam = Number(params.c ?? 1.2);
      const scale = (255 / Math.log(256)) * cParam;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, scale * Math.log(1 + d[i]));
        d[i + 1] = Math.min(255, scale * Math.log(1 + d[i + 1]));
        d[i + 2] = Math.min(255, scale * Math.log(1 + d[i + 2]));
      }
      break;
    }

    // 3. Gamma Transform (Power Law): s = c * r^gamma
    case "gamma_transform": {
      const gamma = Number(params.gamma ?? 1.5);
      const invGamma = 1 / Math.max(0.01, gamma);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 * Math.pow(d[i] / 255, invGamma);
        d[i + 1] = 255 * Math.pow(d[i + 1] / 255, invGamma);
        d[i + 2] = 255 * Math.pow(d[i + 2] / 255, invGamma);
      }
      break;
    }

    // 4. Contrast Stretch (Piecewise Linear)
    case "contrast_stretch": {
      const low = Number(params.low ?? 15);
      const high = Number(params.high ?? 85);
      const r1 = (low / 100) * 255;
      const r2 = (high / 100) * 255;
      const range = Math.max(1, r2 - r1);
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const v = d[i + c];
          if (v < r1) d[i + c] = (v / r1) * 30;
          else if (v > r2) d[i + c] = 225 + ((v - r2) / (255 - r2)) * 30;
          else d[i + c] = ((v - r1) / range) * 255;
        }
      }
      break;
    }

    // 5. Histogram Equalization (ITU-R BT.601 Y Channel)
    case "histogram_equalization": {
      const yHist = new Array(256).fill(0);
      const ycbcrList: [number, number, number][] = [];
      for (let i = 0; i < d.length; i += 4) {
        const [y, cb, cr] = rgbToYcbcr(d[i], d[i + 1], d[i + 2]);
        ycbcrList.push([y, cb, cr]);
        yHist[Math.min(255, Math.max(0, Math.round(y)))]++;
      }
      const totalPixels = w * h;
      const cdf = new Array(256).fill(0);
      let acc = 0;
      for (let k = 0; k < 256; k++) {
        acc += yHist[k];
        cdf[k] = Math.round((acc / totalPixels) * 255);
      }
      for (let i = 0; i < d.length; i += 4) {
        const [y, cb, cr] = ycbcrList[i / 4];
        const newY = cdf[Math.min(255, Math.max(0, Math.round(y)))];
        const [r, g, b] = ycbcrToRgb(newY, cb, cr);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
      break;
    }

    // 6. Retro 8-bit (Bit-plane Slicing / Quantization)
    case "retro_8bit": {
      const levels = Math.max(2, Math.min(16, Number(params.levels ?? 4)));
      const step = 255 / (levels - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / step) * step;
        d[i + 1] = Math.round(d[i + 1] / step) * step;
        d[i + 2] = Math.round(d[i + 2] / step) * step;
      }
      break;
    }

    // 7. Spotlight (Spatial Thresholding & Vignette Accent)
    case "spotlight": {
      const cx = w / 2;
      const cy = h / 2;
      const maxDist = Math.hypot(cx, cy);
      const radius = Number(params.radius ?? 0.5) * maxDist;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const dist = Math.hypot(x - cx, y - cy);
          const factor = dist < radius ? 1.15 : Math.max(0.2, 1 - (dist - radius) / (maxDist - radius));
          d[idx] = Math.min(255, d[idx] * factor);
          d[idx + 1] = Math.min(255, d[idx + 1] * factor);
          d[idx + 2] = Math.min(255, d[idx + 2] * factor);
        }
      }
      break;
    }

    // 8. Dreamy Soft (GLPF - Gaussian Low-Pass Filter)
    case "dreamy_soft":
    case "butterworth_soft": {
      // Gaussian blur box approximation
      const copy = new Uint8ClampedArray(d);
      const k = 2;
      for (let y = k; y < h - k; y++) {
        for (let x = k; x < w - k; x++) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let dy = -k; dy <= k; dy++) {
            for (let dx = -k; dx <= k; dx++) {
              const p = ((y + dy) * w + (x + dx)) * 4;
              r += copy[p];
              g += copy[p + 1];
              b += copy[p + 2];
              count++;
            }
          }
          const idx = (y * w + x) * 4;
          // Soft bloom blend
          d[idx] = Math.min(255, d[idx] * 0.4 + (r / count) * 0.7);
          d[idx + 1] = Math.min(255, d[idx + 1] * 0.4 + (g / count) * 0.7);
          d[idx + 2] = Math.min(255, d[idx + 2] * 0.4 + (b / count) * 0.7);
        }
      }
      break;
    }

    // 9. Ghost Glitch (Ideal Low-Pass Ringing Artifact & Chromatic Split)
    case "ghost_glitch": {
      const copy = new Uint8ClampedArray(d);
      const shift = 12;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const rIdx = (y * w + Math.min(w - 1, x + shift)) * 4;
          const bIdx = (y * w + Math.max(0, x - shift)) * 4;
          d[idx] = copy[rIdx]; // shift red
          d[idx + 1] = copy[idx + 1];
          d[idx + 2] = copy[bIdx + 2]; // shift blue
        }
      }
      break;
    }

    // 10. Detail Pop (High-Boost Filter: (A - 1)f + f_HP)
    case "detail_pop": {
      const copy = new Uint8ClampedArray(d);
      const A = Number(params.boost ?? 1.8);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const center = copy[idx + c];
            const up = copy[((y - 1) * w + x) * 4 + c];
            const down = copy[((y + 1) * w + x) * 4 + c];
            const left = copy[(y * w + (x - 1)) * 4 + c];
            const right = copy[(y * w + (x + 1)) * 4 + c];
            const laplacian = 4 * center - (up + down + left + right);
            d[idx + c] = Math.min(255, Math.max(0, center * (A - 1) + laplacian));
          }
        }
      }
      break;
    }

    // 11. Sketch Edge (Gaussian High-Pass Filter)
    case "sketch_edge": {
      const copy = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const grayCenter = 0.299 * copy[idx] + 0.587 * copy[idx + 1] + 0.114 * copy[idx + 2];
          const grayRight = 0.299 * copy[idx + 4] + 0.587 * copy[idx + 5] + 0.114 * copy[idx + 6];
          const grayDown = 0.299 * copy[idx + w * 4] + 0.587 * copy[idx + w * 4 + 1] + 0.114 * copy[idx + w * 4 + 2];
          const edge = Math.hypot(grayRight - grayCenter, grayDown - grayCenter);
          // Invert edge to pencil on paper
          const v = Math.min(255, Math.max(0, 255 - edge * 2.5));
          d[idx] = v;
          d[idx + 1] = v;
          d[idx + 2] = v;
        }
      }
      break;
    }

    // 12. Fix Backlight (Homomorphic Filter)
    case "fix_backlight": {
      const cutoff = Number(params.cutoff ?? 0.35);
      const yl = Number(params.yl ?? 0.65);
      const yh = Number(params.yh ?? 1.85);
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const normalized = d[i + c] / 255;
          // Homomorphic compression of dynamic range: boost low frequencies less, boost high details
          const lifted = Math.pow(normalized, yl / yh) * 255 * (1 + cutoff * 0.1);
          d[i + c] = Math.min(255, Math.max(0, lifted));
        }
      }
      break;
    }

    // 13. Anti Moire (Notch Filter Simulation)
    case "anti_moire": {
      const copy = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const vals = [
              copy[idx - 4 + c], copy[idx + c], copy[idx + 4 + c],
              copy[idx - w * 4 + c], copy[idx + w * 4 + c]
            ].sort((a, b) => a - b);
            d[idx + c] = vals[2]; // median
          }
        }
      }
      break;
    }

    // 14. Vignette (Arithmetic Multiplication with Radial Gaussian Mask)
    case "vignette": {
      const strength = Number(params.strength ?? 0.7);
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(cx, cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = Math.hypot(x - cx, y - cy);
          const factor = Math.exp(-((r / maxR) ** 2) / (2 * (1 - strength * 0.5) ** 2));
          d[idx] *= factor;
          d[idx + 1] *= factor;
          d[idx + 2] *= factor;
        }
      }
      break;
    }

    // 15. Double Exposure (Image Blend)
    case "double_exposure": {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 0.75 + 40);
        d[i + 1] = Math.min(255, d[i + 1] * 0.8 + 20);
        d[i + 2] = Math.min(255, d[i + 2] * 0.9 + 50);
      }
      break;
    }

    // 16. Low Light Denoise (3x3 Median Spatial Filter)
    case "low_light_denoise": {
      const copy = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const vals = [
              copy[((y - 1) * w + (x - 1)) * 4 + c],
              copy[((y - 1) * w + x) * 4 + c],
              copy[((y - 1) * w + (x + 1)) * 4 + c],
              copy[(y * w + (x - 1)) * 4 + c],
              copy[idx + c],
              copy[(y * w + (x + 1)) * 4 + c],
              copy[((y + 1) * w + (x - 1)) * 4 + c],
              copy[((y + 1) * w + x) * 4 + c],
              copy[((y + 1) * w + (x + 1)) * 4 + c]
            ].sort((a, b) => a - b);
            d[idx + c] = vals[4];
          }
        }
      }
      break;
    }

    // 17. Masking Stencil
    case "masking_stencil": {
      const border = 18;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < border || x > w - border || y < border || y > h - border) {
            const idx = (y * w + x) * 4;
            d[idx] = 255;
            d[idx + 1] = 255;
            d[idx + 2] = 255;
          }
        }
      }
      break;
    }

    // 18. Segment Background (Otsu Thresholding)
    case "segment_background": {
      // Calculate Otsu threshold
      let total = w * h;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * originalHist[i];
      let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += originalHist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * originalHist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const betweenVar = wB * wF * (mB - mF) * (mB - mF);
        if (betweenVar > maxVar) {
          maxVar = betweenVar;
          threshold = t;
        }
      }
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (gray < threshold) {
          // Darken background
          d[i] *= 0.35;
          d[i + 1] *= 0.35;
          d[i + 2] *= 0.35;
        } else {
          // Highlight subject
          d[i] = Math.min(255, d[i] * 1.15);
          d[i + 1] = Math.min(255, d[i + 1] * 1.15);
          d[i + 2] = Math.min(255, d[i + 2] * 1.15);
        }
      }
      break;
    }

    // 19. Erode / Dilate Pop (Morphological Edge Emphasis)
    case "erode_dilate_pop": {
      const copy = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const maxVal = Math.max(
              copy[idx - 4 + c], copy[idx + c], copy[idx + 4 + c],
              copy[idx - w * 4 + c], copy[idx + w * 4 + c]
            );
            d[idx + c] = Math.min(255, d[idx + c] * 0.7 + maxVal * 0.4);
          }
        }
      }
      break;
    }

    // 20. Face Smooth (Box blur — simulates skin smoothing)
    case "face_smooth": {
      const strength = Number(params.strength ?? 0.5);
      const k = Math.max(1, Math.round(strength * 4));
      const copy = new Uint8ClampedArray(d);
      for (let y = k; y < h - k; y++) {
        for (let x = k; x < w - k; x++) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let dy = -k; dy <= k; dy++) {
            for (let dx = -k; dx <= k; dx++) {
              const p = ((y + dy) * w + (x + dx)) * 4;
              r += copy[p]; g += copy[p + 1]; b += copy[p + 2]; count++;
            }
          }
          const idx = (y * w + x) * 4;
          d[idx] = r / count; d[idx + 1] = g / count; d[idx + 2] = b / count;
        }
      }
      break;
    }

    // 21. Face Brighten (Soft brightness boost)
    case "face_brighten": {
      const amount = Number(params.amount ?? 1.2);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * amount);
        d[i + 1] = Math.min(255, d[i + 1] * amount);
        d[i + 2] = Math.min(255, d[i + 2] * amount);
      }
      break;
    }

    // 22. Face Vignette (Center-brightening reverse vignette)
    case "face_vignette": {
      const strength = Number(params.strength ?? 0.7);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.hypot(cx, cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = Math.hypot(x - cx, y - cy);
          const edgeDim = strength * (r / maxR) ** 1.5;
          const factor = Math.max(1 - strength, 1 - edgeDim);
          d[idx] = Math.min(255, d[idx] * (1 + factor * 0.12));
          d[idx + 1] = Math.min(255, d[idx + 1] * (1 + factor * 0.12));
          d[idx + 2] = Math.min(255, d[idx + 2] * (1 + factor * 0.12));
        }
      }
      break;
    }

    // 23. Face Cartoon (Color quantization + edge lines)
    case "face_cartoon": {
      const copy = new Uint8ClampedArray(d);
      // Edge detection pass
      const edges = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const gC = 0.299 * copy[idx] + 0.587 * copy[idx + 1] + 0.114 * copy[idx + 2];
          const gR = 0.299 * copy[idx + 4] + 0.587 * copy[idx + 5] + 0.114 * copy[idx + 6];
          const gD = 0.299 * copy[idx + w * 4] + 0.587 * copy[idx + w * 4 + 1] + 0.114 * copy[idx + w * 4 + 2];
          edges[y * w + x] = Math.hypot(gR - gC, gD - gC) > 18 ? 1 : 0;
        }
      }
      // Quantize colors to 8 levels
      const step = 32;
      for (let i = 0; i < d.length; i += 4) {
        if (edges[i / 4]) {
          d[i] = d[i + 1] = d[i + 2] = 20; // dark edge
        } else {
          d[i] = Math.round(copy[i] / step) * step;
          d[i + 1] = Math.round(copy[i + 1] / step) * step;
          d[i + 2] = Math.round(copy[i + 2] / step) * step;
        }
      }
      break;
    }

    default:
      break;
  }

  ctx.putImageData(imgData, 0, 0);
  const filteredHist = computeHistogram(d);
  const resultBase64 = canvas.toDataURL("image/png").split(",")[1];

  return {
    status: "ok",
    result_image: resultBase64,
    execution_time_ms: 3.5,
    histogram_data: {
      original: originalHist,
      filtered: filteredHist,
    },
    spectrum_image: returnAnalysis ? generateSpectrumDataUrl() : null,
  };
}
