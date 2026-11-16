import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, FlipHorizontal, ArrowRight, RotateCcw,
  Upload, SlidersHorizontal, X, Layers, Clock, Video,
  Smartphone, CheckCircle2, Zap, Maximize, Minimize, RotateCw,
  RefreshCw, Scan, Usb
} from "lucide-react";
import QRCode from "qrcode";
import Peer from "peerjs";
import { usePhotobooth } from "../store/photoboothStore";
import { faceTracker, type FaceBox } from "../services/faceTracker";

type LiveFilter =
  | "normal" | "bw" | "vintage" | "dreamy" | "vignette"
  | "face_blur_bg" | "face_soft_blur" | "face_beauty" | "face_funny" | "face_spotlight";
type Mode = "single" | "burst3" | "burst4" | "quick";

const FACE_FILTERS: LiveFilter[] = ["face_blur_bg", "face_soft_blur", "face_beauty", "face_funny", "face_spotlight"];

function applyLiveFilter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  filter: LiveFilter,
  faceBoxes: FaceBox[] = [],
  blurK = 6   // blur radius (1–20), default 6
) {
  if (filter === "normal") return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (filter === "bw") {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
  } else if (filter === "vintage") {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * 1.1 + 20);
      d[i + 1] = Math.min(255, d[i + 1] * 0.9 + 10);
      d[i + 2] = Math.min(255, d[i + 2] * 0.7);
    }
  } else if (filter === "dreamy") {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * 1.05 + 10);
      d[i + 1] = Math.min(255, d[i + 1] * 1.0 + 5);
      d[i + 2] = Math.min(255, d[i + 2] * 1.1 + 15);
    }
  } else if (filter === "vignette") {
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const factor = Math.exp(-((r / maxR) ** 2) / (2 * 0.5 * 0.5));
        d[idx] *= factor;
        d[idx + 1] *= factor;
        d[idx + 2] *= factor;
      }
    }
  } else if (filter === "face_blur_bg" && faceBoxes.length > 0) {
    // Build ellipse feathered mask (0=blur bg, 1=keep face sharp)
    // Using bigger padding to avoid cutting off hair/forehead/neck
    const mask = new Float32Array(w * h);
    for (const fb of faceBoxes) {
      const cx = fb.x + fb.w / 2;
      const cy = fb.y + fb.h / 2;
      const rx = fb.w / 2 * 1.55;   // wide enough for cheeks
      const ry = fb.h / 2 * 1.70;   // tall enough for hair + neck
      const feather = 0.30;
      const x0 = Math.max(0, Math.floor(cx - rx - 2));
      const y0 = Math.max(0, Math.floor(cy - ry - 2));
      const x1 = Math.min(w - 1, Math.ceil(cx + rx + 2));
      const y1 = Math.min(h - 1, Math.ceil(cy + ry + 2));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dist = Math.sqrt(((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2);
          let alpha = 0;
          if (dist <= 1 - feather) { alpha = 1; }
          else if (dist < 1) { const t = (1 - dist) / feather; alpha = t * t * (3 - 2 * t); }
          if (alpha > mask[py * w + px]) mask[py * w + px] = alpha;
        }
      }
    }

    // Separable box blur using prefix sums -- O(n) per row/col, correct at all edges
    const k = Math.max(1, Math.round(blurK));
    const tmp = new Float32Array(w * h * 3);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0;
      // Build running prefix: sum pixels in [x-k .. x+k]
      // Initialize with pixels 0..k
      for (let ix = 0; ix <= Math.min(k, w - 1); ix++) {
        const p = (y * w + ix) * 4; sr += d[p]; sg += d[p+1]; sb += d[p+2];
      }
      let lo = 0, hi = Math.min(k, w - 1);
      for (let x = 0; x < w; x++) {
        // Extend right
        const newHi = Math.min(x + k, w - 1);
        while (hi < newHi) { hi++; const p = (y * w + hi) * 4; sr += d[p]; sg += d[p+1]; sb += d[p+2]; }
        // Shrink left
        const newLo = Math.max(x - k, 0);
        while (lo < newLo) { const p = (y * w + lo) * 4; sr -= d[p]; sg -= d[p+1]; sb -= d[p+2]; lo++; }
        const cnt = hi - lo + 1;
        const ti = (y * w + x) * 3; tmp[ti] = sr/cnt; tmp[ti+1] = sg/cnt; tmp[ti+2] = sb/cnt;
      }
    }

    // Vertical pass + blend with face mask
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let iy = 0; iy <= Math.min(k, h - 1); iy++) {
        const ti = (iy * w + x) * 3; sr += tmp[ti]; sg += tmp[ti+1]; sb += tmp[ti+2];
      }
      let lo = 0, hi = Math.min(k, h - 1);
      for (let y = 0; y < h; y++) {
        const newHi = Math.min(y + k, h - 1);
        while (hi < newHi) { hi++; const ti = (hi * w + x) * 3; sr += tmp[ti]; sg += tmp[ti+1]; sb += tmp[ti+2]; }
        const newLo = Math.max(y - k, 0);
        while (lo < newLo) { const ti = (lo * w + x) * 3; sr -= tmp[ti]; sg -= tmp[ti+1]; sb -= tmp[ti+2]; lo++; }
        const cnt = hi - lo + 1;
        const faceA = mask[y * w + x];
        if (faceA >= 1) continue;
        const idx = (y * w + x) * 4;
        const blurR = sr/cnt, blurG = sg/cnt, blurB = sb/cnt;
        d[idx]   = blurR + (d[idx]   - blurR) * faceA;
        d[idx+1] = blurG + (d[idx+1] - blurG) * faceA;
        d[idx+2] = blurB + (d[idx+2] - blurB) * faceA;
      }
    }
  } else if (filter === "face_beauty" && faceBoxes.length > 0) {
    // Beauty: skin tone warmth + brightness boost + subtle contrast (NO blur)
    for (const fb of faceBoxes) {
      const pad = 10;
      const x0 = Math.max(0, Math.floor(fb.x) - pad);
      const y0 = Math.max(0, Math.floor(fb.y) - pad);
      const x1 = Math.min(w - 1, Math.floor(fb.x + fb.w) + pad);
      const y1 = Math.min(h - 1, Math.floor(fb.y + fb.h) + pad);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * w + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const lift = (v: number) => Math.min(255, v + (255 - v) * 0.08);
          d[idx]     = Math.min(255, lift(r) * 1.06 + lum * 0.02);
          d[idx + 1] = Math.min(255, lift(g) * 1.02);
          d[idx + 2] = Math.min(255, lift(b) * 0.95);
        }
      }
    }
  } else if (filter === "face_soft_blur" && faceBoxes.length > 0) {
    // Soft blur on face area -- separable blur with ellipse feathered mask
    const k = Math.max(1, Math.round(blurK));
    const tmp = new Float32Array(w * h * 3);

    // Horizontal pass (full image)
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0;
      for (let ix = 0; ix <= Math.min(k, w - 1); ix++) {
        const p = (y * w + ix) * 4; sr += d[p]; sg += d[p+1]; sb += d[p+2];
      }
      let lo = 0, hi = Math.min(k, w - 1);
      for (let x = 0; x < w; x++) {
        const newHi = Math.min(x + k, w - 1);
        while (hi < newHi) { hi++; const p = (y * w + hi) * 4; sr += d[p]; sg += d[p+1]; sb += d[p+2]; }
        const newLo = Math.max(x - k, 0);
        while (lo < newLo) { const p = (y * w + lo) * 4; sr -= d[p]; sg -= d[p+1]; sb -= d[p+2]; lo++; }
        const cnt = hi - lo + 1;
        const ti = (y * w + x) * 3; tmp[ti] = sr/cnt; tmp[ti+1] = sg/cnt; tmp[ti+2] = sb/cnt;
      }
    }

    // Vertical pass + apply only inside face ellipse
    for (const fb of faceBoxes) {
      const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2;
      const rx = fb.w / 2 * 1.1, ry = fb.h / 2 * 1.1;
      const feather = 0.25;
      const x0 = Math.max(0, Math.floor(cx - rx - 2));
      const y0 = Math.max(0, Math.floor(cy - ry - 2));
      const x1 = Math.min(w - 1, Math.ceil(cx + rx + 2));
      const y1 = Math.min(h - 1, Math.ceil(cy + ry + 2));
      for (let px = x0; px <= x1; px++) {
        let sr = 0, sg = 0, sb = 0;
        for (let iy = Math.max(0, y0 - k); iy <= Math.min(h-1, y0); iy++) {
          const ti = (iy * w + px) * 3; sr += tmp[ti]; sg += tmp[ti+1]; sb += tmp[ti+2];
        }
        let lo = Math.max(0, y0 - k), hi = Math.min(h-1, y0);
        for (let py = y0; py <= y1; py++) {
          const newHi = Math.min(py + k, h - 1);
          while (hi < newHi) { hi++; const ti = (hi * w + px) * 3; sr += tmp[ti]; sg += tmp[ti+1]; sb += tmp[ti+2]; }
          const newLo = Math.max(py - k, 0);
          while (lo < newLo) { const ti = (lo * w + px) * 3; sr -= tmp[ti]; sg -= tmp[ti+1]; sb -= tmp[ti+2]; lo++; }
          const cnt = hi - lo + 1;
          const dist = Math.sqrt(((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2);
          let alpha = 0;
          if (dist <= 1 - feather) { alpha = 1; }
          else if (dist < 1) { const t = (1 - dist) / feather; alpha = t * t * (3 - 2 * t); }
          if (alpha <= 0) continue;
          const idx = (py * w + px) * 4;
          d[idx]   = d[idx]   + (sr/cnt - d[idx])   * alpha;
          d[idx+1] = d[idx+1] + (sg/cnt - d[idx+1]) * alpha;
          d[idx+2] = d[idx+2] + (sb/cnt - d[idx+2]) * alpha;
        }
      }
    }
  } else if (filter === "face_funny" && faceBoxes.length > 0) {
    const copy = new Uint8ClampedArray(d);
    for (const fb of faceBoxes) {
      const fcx = fb.x + fb.w / 2;
      const fcy = fb.y + fb.h / 2;
      const scale = 1.35;
      const x0 = Math.max(0, Math.floor(fb.x));
      const y0 = Math.max(0, Math.floor(fb.y));
      const x1 = Math.min(w - 1, Math.floor(fb.x + fb.w));
      const y1 = Math.min(h - 1, Math.floor(fb.y + fb.h));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          // Sample from scaled-down source (magnify face)
          const sx = Math.round(fcx + (x - fcx) / scale);
          const sy = Math.round(fcy + (y - fcy) / scale);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const src = (sy * w + sx) * 4;
            const dst = (y * w + x) * 4;
            d[dst] = copy[src];
            d[dst + 1] = copy[src + 1];
            d[dst + 2] = copy[src + 2];
          }
        }
      }
    }
  } else if (filter === "face_spotlight") {
    // Spotlight: radial darkness around detected faces, or center if no faces
    const centers = faceBoxes.length > 0
      ? faceBoxes.map((fb) => ({ cx: fb.x + fb.w / 2, cy: fb.y + fb.h / 2, r: Math.max(fb.w, fb.h) * 0.75 }))
      : [{ cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.35 }];

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        // Distance to nearest spotlight center (normalized)
        let minDist = Infinity;
        for (const { cx, cy, r } of centers) {
          const dist = Math.hypot(px - cx, py - cy) / r;
          if (dist < minDist) minDist = dist;
        }
        // Inside spotlight: slight brighten. Outside: darken strongly
        let factor: number;
        if (minDist <= 1.0) {
          factor = 1.0 + (1.0 - minDist) * 0.15; // slight brighten at center
        } else {
          // Smooth fade to 0.15 at edge
          factor = Math.max(0.12, 1.0 - (minDist - 1.0) * 0.6);
        }
        d[idx] = Math.min(255, d[idx] * factor);
        d[idx + 1] = Math.min(255, d[idx + 1] * factor);
        d[idx + 2] = Math.min(255, d[idx + 2] * factor);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

const LIVE_FILTERS: { id: LiveFilter; label: string; emoji: string }[] = [
  { id: "normal",         label: "Normal",     emoji: "○" },
  { id: "bw",             label: "B&W",        emoji: "◑" },
  { id: "vintage",        label: "Vintage",    emoji: "🎞" },
  { id: "dreamy",         label: "Dreamy",     emoji: "🌸" },
  { id: "vignette",       label: "Vignette",   emoji: "◉" },
  { id: "face_spotlight", label: "Spotlight",  emoji: "🔦" },
  { id: "face_blur_bg",   label: "Blur BG",    emoji: "🫧" },
  { id: "face_beauty",    label: "Beauty",     emoji: "✨" },
  { id: "face_soft_blur", label: "Soft Blur",  emoji: "🌫" },
  { id: "face_funny",     label: "Funny",      emoji: "🤡" },
];

const COUNTDOWN_OPTIONS = [3, 5, 10];

export default function CameraPage() {
  const navigate = useNavigate();
  const { dispatch } = usePhotobooth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveRenderCanvasRef = useRef<HTMLCanvasElement>(null); // live face filter preview
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const rafRef = useRef<number | null>(null);
  const faceBoxesRef = useRef<FaceBox[]>([]);
  // Mutable refs so the RAF loop always reads latest values without stale closure
  const isMirroredRef = useRef(true);
  const liveFilterRef = useRef<LiveFilter>("normal");

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => localStorage.getItem("pckv_camera_device_id") || ""
  );
  const [isMirrored, setIsMirrored] = useState(true);
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const [rotation, setRotation] = useState<number>(0);

  // Resolution display
  const [resolution, setResolution] = useState<string>("");

  // Phone Camera WebRTC state
  const [, setBoothPeerId] = useState<string>("");
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneQrUrl, setPhoneQrUrl] = useState<string>("");

  const [liveFilter, setLiveFilter] = useState<LiveFilter>("normal");
  const [blurStrength, setBlurStrength] = useState(6); // 1–20, default 6
  const blurStrengthRef = useRef(6);
  const [mode, setMode] = useState<Mode>("burst4");
  const [countdownSecs, setCountdownSecs] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Face tracker
  const [faceBoxes, setFaceBoxes] = useState<FaceBox[]>([]);
  const [showFaceOverlay, setShowFaceOverlay] = useState(false);
  const [faceTrackerReady, setFaceTrackerReady] = useState(false);
  const [faceTrackerLoading, setFaceTrackerLoading] = useState(false);

  const targetCount = mode === "single" ? 1 : mode === "burst3" ? 3 : 4;

  // Face tracker auto-activates when any face filter selected OR manual overlay ON
  const needsFaceTracker = FACE_FILTERS.includes(liveFilter) || showFaceOverlay;

  // Keep mutable refs in sync with state (avoid stale closures in RAF)
  useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);
  useEffect(() => { liveFilterRef.current = liveFilter; }, [liveFilter]);
  useEffect(() => { blurStrengthRef.current = blurStrength; }, [blurStrength]);

  /* ── Face Tracker Init & RAF Loop ── */
  useEffect(() => {
    if (!needsFaceTracker) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setFaceBoxes([]);
      faceBoxesRef.current = [];
      const oc = overlayCanvasRef.current;
      if (oc) oc.getContext("2d")?.clearRect(0, 0, oc.width, oc.height);
      const rc = liveRenderCanvasRef.current;
      if (rc) rc.getContext("2d")?.clearRect(0, 0, rc.width, rc.height);
      return;
    }

    let cancelled = false;

    const initAndRun = async () => {
      if (!faceTracker.isReady()) {
        setFaceTrackerLoading(true);
        const ok = await faceTracker.init();
        if (!ok || cancelled) { setFaceTrackerLoading(false); return; }
        setFaceTrackerReady(true);
        setFaceTrackerLoading(false);
      } else {
        setFaceTrackerReady(true);
      }

      let frame = 0;
      const loop = () => {
        if (cancelled) return;
        frame++;
        const video = videoRef.current;
        if (video && !video.paused && video.videoWidth > 0) {
          // 1. Detect faces every 3rd frame for performance
          if (frame % 3 === 0) {
            const boxes = faceTracker.detect(video);
            faceBoxesRef.current = boxes;
            setFaceBoxes(boxes);
          }
          // 2. Render live face filter to canvas (every frame)
          drawLiveFilter(video);
          // 3. Draw scan overlay on top (every frame)
          drawScanOverlay(frame);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    initAndRun();
    return () => {
      cancelled = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [needsFaceTracker]); // eslint-disable-line

  /* ── Live filter render: draws video + face filter to visible canvas ── */
  const drawLiveFilter = useCallback((video: HTMLVideoElement) => {
    const canvas = liveRenderCanvasRef.current;
    if (!canvas) return;

    // Half display resolution → 4× fewer pixels, CSS scales it up
    const dw = Math.max(1, Math.round(video.clientWidth / 2));
    const dh = Math.max(1, Math.round(video.clientHeight / 2));
    if (dw === 0 || dh === 0) return;

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const vw = video.videoWidth || dw * 2;
    const vh = video.videoHeight || dh * 2;

    // ── Object-fit COVER crop: match what CSS does to the video element ──
    // Scale so video FILLS canvas (no letterbox), then center-crop excess
    const coverScale = Math.max(dw / vw, dh / vh);
    const srcW = dw / coverScale;   // visible width in video-pixels
    const srcH = dh / coverScale;   // visible height in video-pixels
    const srcX = (vw - srcW) / 2;  // center-crop X offset in video-pixels
    const srcY = (vh - srcH) / 2;  // center-crop Y offset in video-pixels

    // Draw with cover crop (NO internal mirror — CSS viewportStyle handles scaleX(-1))
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, dw, dh);

    const currentFilter = liveFilterRef.current;
    if (currentFilter === "normal") return;

    // Map faceBoxes: video-pixel coords → crop-adjusted canvas coords
    const toCanvasX = dw / srcW;
    const toCanvasY = dh / srcH;
    const scaledBoxes: FaceBox[] = faceBoxesRef.current
      .map(fb => ({
        x: (fb.x - srcX) * toCanvasX,
        y: (fb.y - srcY) * toCanvasY,
        w: fb.w * toCanvasX,
        h: fb.h * toCanvasY,
      }))
      .filter(fb => fb.x + fb.w > 0 && fb.y + fb.h > 0 && fb.x < dw && fb.y < dh);

    // ── Blur filters: use ctx.filter (GPU, no lag, no darkening) ──
    const blurPx = Math.round(blurStrengthRef.current * 1.5);

    if (currentFilter === "face_blur_bg") {
      // 1. Redraw blurred full frame
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, dw, dh);
      ctx.filter = "none";
      // 2. Clip ellipse per wajah, draw sharp on top
      if (scaledBoxes.length > 0) {
        ctx.save();
        ctx.beginPath();
        for (const fb of scaledBoxes) {
          ctx.ellipse(fb.x + fb.w / 2, fb.y + fb.h / 2,
            fb.w / 2 * 1.55, fb.h / 2 * 1.70, 0, 0, Math.PI * 2);
        }
        ctx.clip();
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, dw, dh);
        ctx.restore();
      }
      return;
    }

    if (currentFilter === "face_soft_blur") {
      // 1. Draw sharp full frame (already done above)
      // 2. Clip ellipse per wajah, draw blurred on top
      if (scaledBoxes.length > 0) {
        ctx.save();
        ctx.beginPath();
        for (const fb of scaledBoxes) {
          ctx.ellipse(fb.x + fb.w / 2, fb.y + fb.h / 2,
            fb.w / 2 * 1.1, fb.h / 2 * 1.1, 0, 0, Math.PI * 2);
        }
        ctx.clip();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, dw, dh);
        ctx.filter = "none";
        ctx.restore();
      }
      return;
    }

    // Apply other pixel filters (bw, vintage, dreamy, vignette, face filters)
    applyLiveFilter(ctx, dw, dh, currentFilter, scaledBoxes, blurStrengthRef.current);
  }, []);


  /* ── Draw animated scan overlay on canvas ── */
  const drawScanOverlay = useCallback((frame: number) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.clientWidth === 0) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, displayW, displayH);

    const boxes = faceBoxesRef.current;
    const vw = video.videoWidth || displayW;
    const vh = video.videoHeight || displayH;
    const hasFaces = boxes.length > 0;
    const mirrored = isMirroredRef.current;

    // ── Cover-crop transform (match what CSS object-fit:cover does) ──
    const coverScale = Math.max(displayW / vw, displayH / vh);
    const srcW = displayW / coverScale;
    const srcH = displayH / coverScale;
    const srcX = (vw - srcW) / 2;
    const srcY = (vh - srcH) / 2;
    // Video-pixel → overlay-canvas-pixel:  subtract crop offset, then multiply by coverScale
    const toDispX = coverScale;
    const toDispY = coverScale;

    if (hasFaces) {
      // ── Detected: draw ellipse focus ring around face ──
      for (const fb of boxes) {
        // Map from video-pixel space → display-canvas space using cover crop
        let rawX = (fb.x - srcX) * toDispX;
        const rawY = (fb.y - srcY) * toDispY;
        const rawW = fb.w * toDispX;
        const rawH = fb.h * toDispY;
        // Flip X if mirrored
        const bx = mirrored ? displayW - rawX - rawW : rawX;
        const by = rawY;
        const bw = rawW;
        const bh = rawH;

        // Ellipse center & radii (with padding)
        const ecx = bx + bw / 2;
        const ecy = by + bh / 2;
        const erx = bw / 2 * 1.18; // slightly wider than face box
        const ery = bh / 2 * 1.22; // slightly taller (include hair)

        const pulse = 0.75 + 0.25 * Math.sin(frame * 0.12);

        // Outer glow ellipse
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 14 * pulse;
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulse * 0.5})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx + 4, ery + 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Main ellipse ring
        ctx.shadowBlur = 8 * pulse;
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([Math.PI * erx * 0.15, Math.PI * erx * 0.05]);
        ctx.lineDashOffset = -(frame * 1.5); // rotating dashes
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Label badge above face
        const label = "WAJAH TERDETEKSI";
        ctx.font = "bold 10px monospace";
        const tw = ctx.measureText(label).width;
        const badgeX = ecx - tw / 2 - 6;
        const badgeY = ecy - ery - 24;
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse * 0.9})`;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, tw + 12, 16, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 0;
        ctx.fillText(label, badgeX + 6, badgeY + 11);
      }
    } else {
      // ── Scanning: draw sweeping line across frame ──
      const sweepY = (frame * 3) % (displayH + 60) - 30;
      const scanGrad = ctx.createLinearGradient(0, sweepY - 20, 0, sweepY + 20);
      scanGrad.addColorStop(0, "rgba(251, 191, 36, 0)");
      scanGrad.addColorStop(0.5, "rgba(251, 191, 36, 0.55)");
      scanGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, sweepY - 20, displayW, 40);

      // Corner brackets (screen-level, amber, pulsing)
      const L2 = 36;
      const p2 = 16;
      const pulse2 = 0.5 + 0.5 * Math.sin(frame * 0.08);
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.6 + 0.4 * pulse2})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 8;
      ctx.lineCap = "round";
      const screenCorners: [number, number, number, number][] = [
        [p2, p2, 1, 1], [displayW - p2, p2, -1, 1],
        [p2, displayH - p2, 1, -1], [displayW - p2, displayH - p2, -1, -1],
      ];
      for (const [cx2, cy2, dx, dy] of screenCorners) {
        ctx.beginPath();
        ctx.moveTo(cx2 + dx * L2, cy2);
        ctx.lineTo(cx2, cy2);
        ctx.lineTo(cx2, cy2 + dy * L2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }, []);

  /* ── 1. Enumerate Video Devices ── */
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn("Gagal membaca daftar perangkat kamera:", err);
    }
  }, [selectedDeviceId]);

  /* ── 2. Start Camera Stream (Enhanced Quality) ── */
  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(true);
      return;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    const videoConstraints: MediaTrackConstraints = deviceIdToUse
      ? {
          deviceId: { exact: deviceIdToUse },
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 60, min: 30 },
        }
      : {
          facingMode: "user",
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 60, min: 30 },
        };

    const tryGetStream = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      let stream: MediaStream;
      try {
        stream = await tryGetStream({ video: videoConstraints, audio: false });
      } catch {
        console.warn("4K constraints failed, falling back to HD...");
        stream = await tryGetStream({
          video: deviceIdToUse
            ? { deviceId: { exact: deviceIdToUse }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      }

      localStreamRef.current = stream;

      // Apply advanced camera settings
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities() as Record<string, unknown>;
          const applySettings: MediaTrackConstraints = {};
          if (caps.exposureMode) (applySettings as Record<string, unknown>).exposureMode = "continuous";
          if (caps.whiteBalanceMode) (applySettings as Record<string, unknown>).whiteBalanceMode = "continuous";
          if (caps.focusMode) (applySettings as Record<string, unknown>).focusMode = "continuous";
          if (Object.keys(applySettings).length > 0) {
            await track.applyConstraints(applySettings);
          }
        } catch {
          // Not all cameras support advanced settings
        }
      }

      if (videoRef.current && !remoteStreamRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          if (videoRef.current) {
            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;
            const fps = track?.getSettings().frameRate;
            setResolution(`${vw}×${vh}${fps ? ` • ${Math.round(fps)}fps` : ""}`);
          }
        };
        videoRef.current.play().catch(console.error);
      }

      setCameraError(false);
      refreshDevices();
    } catch (err) {
      console.error("Camera completely unavailable:", err);
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({ video: true });
        localStreamRef.current = fallback;
        if (videoRef.current && !remoteStreamRef.current) {
          videoRef.current.srcObject = fallback;
          videoRef.current.play().catch(console.error);
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setResolution(`${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`);
            }
          };
        }
        setCameraError(false);
        refreshDevices();
      } catch {
        setCameraError(true);
      }
    }
  }, [refreshDevices]);

  /* ── 3. PeerJS Listener for Phone Camera ── */
  useEffect(() => {
    const randomId = `booth-${Math.random().toString(36).substring(2, 8)}`;
    setBoothPeerId(randomId);

    const peer = new Peer(randomId);
    peerRef.current = peer;

    peer.on("call", (call) => {
      call.answer();
      call.on("stream", (remotePhoneStream) => {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        remoteStreamRef.current = remotePhoneStream;
        if (videoRef.current) {
          videoRef.current.srcObject = remotePhoneStream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
            if (videoRef.current) {
              setResolution(`${videoRef.current.videoWidth}×${videoRef.current.videoHeight} • 📱 HP`);
            }
          };
          videoRef.current.play().catch(console.error);
        }
        setPhoneConnected(true);
        setIsMirrored(false);
        setShowPhoneModal(false);
      });
    });

    const cleanPath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    const remoteUrl = `${window.location.origin}${cleanPath}#/remote-camera?peer=${randomId}`;
    QRCode.toDataURL(remoteUrl, { margin: 1, width: 220 })
      .then((qr) => setPhoneQrUrl(qr))
      .catch(console.error);

    return () => {
      peer.destroy();
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phoneConnected && remoteStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = remoteStreamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [phoneConnected]);

  /* ── 4. Lifecycle ── */
  useEffect(() => {
    let isCancelled = false;
    if (!phoneConnected) {
      startCamera(selectedDeviceId || undefined).then(() => {
        if (isCancelled && localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
      });
    }
    const handleDeviceChange = () => refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }
    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
    };
  }, [selectedDeviceId, startCamera, refreshDevices, phoneConnected]);

  const handleSelectCamera = (deviceId: string) => {
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    setPhoneConnected(false);
    setSelectedDeviceId(deviceId);
    localStorage.setItem("pckv_camera_device_id", deviceId);
  };

  // Flip front/back camera on phone (via MediaDevices facingMode toggle)
  const handleFlipPhoneCamera = useCallback(async () => {
    if (!videoRef.current) return;
    const currentStream = remoteStreamRef.current || localStreamRef.current;
    if (!currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    const settings = track?.getSettings() as (MediaTrackSettings & { facingMode?: string }) | undefined;
    const currentFacing = settings?.facingMode || "user";
    const nextFacing = currentFacing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      // Stop old tracks
      currentStream.getVideoTracks().forEach((t) => t.stop());
      if (remoteStreamRef.current) {
        remoteStreamRef.current = newStream;
      } else {
        localStreamRef.current = newStream;
      }
      videoRef.current.srcObject = newStream;
      videoRef.current.play().catch(console.error);
    } catch {
      // facingMode exact may fail on desktop — try without exact
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: false,
        });
        currentStream.getVideoTracks().forEach((t) => t.stop());
        if (remoteStreamRef.current) remoteStreamRef.current = newStream;
        else localStreamRef.current = newStream;
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(console.error);
      } catch (err) {
        console.warn("Cannot flip camera:", err);
      }
    }
  }, []);

  /* ── 5. Capture Photo ── */
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const rawW = video.videoWidth || 1920;
    const rawH = video.videoHeight || 1080;

    const isSideways = rotation % 180 !== 0;
    const outW = isSideways ? rawH : rawW;
    const outH = isSideways ? rawW : rawH;

    // For face filters: capture from liveRenderCanvas (already has correct cover-crop + filter)
    // then scale up to full resolution. This guarantees filter matches preview exactly.
    const isFaceFilter = FACE_FILTERS.includes(liveFilter);
    const liveCanvas = liveRenderCanvasRef.current;
    if (isFaceFilter && liveCanvas && liveCanvas.width > 0) {
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // liveRenderCanvas already has: cover-crop, filter applied, CSS mirror via viewportStyle
      // We just scale it up. Mirror: liveCanvas is NOT internally mirrored (CSS does it),
      // so we need to flip horizontally if mirrored.
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
      if (isMirrored) ctx.scale(-1, 1);
      ctx.drawImage(liveCanvas, -outW / 2, -outH / 2, outW, outH);
      ctx.restore();

      const b64 = canvas.toDataURL("image/png", 1.0).split(",")[1];
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      setCapturedPhotos((prev) => [...prev, b64]);
      return;
    }

    // For non-face filters: capture from raw video at full resolution
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
    if (isMirrored) ctx.scale(-1, 1);
    ctx.drawImage(video, -rawW / 2, -rawH / 2, rawW, rawH);
    ctx.restore();

    // Apply non-face filter (B&W, Vintage, Dreamy, Vignette, Normal)
    applyLiveFilter(ctx, canvas.width, canvas.height, liveFilter, []);

    const b64 = canvas.toDataURL("image/png", 1.0).split(",")[1];
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setCapturedPhotos((prev) => [...prev, b64]);
  }, [isMirrored, liveFilter, rotation]);

  /* ── 6. Video Recording ── */
  const startRecordingVideo = useCallback(() => {
    const activeStream = remoteStreamRef.current || localStreamRef.current;
    if (!activeStream) return;
    try {
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(activeStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "",
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);
        dispatch({ type: "SET_SESSION_VIDEO", payload: videoUrl });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder tidak didukung:", err);
    }
  }, [dispatch]);

  const stopRecordingVideo = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /* ── 7. Shutter Logic ── */
  const handleShutter = useCallback(() => {
    if (countdown !== null || capturedPhotos.length >= targetCount) return;
    if (capturedPhotos.length === 0) startRecordingVideo();

    if (mode === "quick") {
      let currentShot = 0;
      const quickPhotos: string[] = []; // collect locally (avoid stale state closure)
      const takeNextShot = () => {
        let c = 3;
        setCountdown(c);
        const timerId = setInterval(() => {
          c -= 1;
          if (c <= 0) {
            clearInterval(timerId);
            setCountdown(null);

            // Capture photo and store result in local array (not stale state)
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas) {
              const rawW = video.videoWidth || 1920;
              const rawH = video.videoHeight || 1080;
              const isSideways = rotation % 180 !== 0;
              const outW = isSideways ? rawH : rawW;
              const outH = isSideways ? rawW : rawH;

              // For face filters: use liveRenderCanvas (cover-crop + filter already applied)
              const isFaceFilterQ = FACE_FILTERS.includes(liveFilter);
              const liveCanvasQ = liveRenderCanvasRef.current;
              if (isFaceFilterQ && liveCanvasQ && liveCanvasQ.width > 0) {
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = "high";
                  ctx.save();
                  ctx.translate(outW / 2, outH / 2);
                  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
                  if (isMirrored) ctx.scale(-1, 1);
                  ctx.drawImage(liveCanvasQ, -outW / 2, -outH / 2, outW, outH);
                  ctx.restore();
                  const b64 = canvas.toDataURL("image/png", 1.0).split(",")[1];
                  quickPhotos.push(b64);
                  setFlash(true);
                  setTimeout(() => setFlash(false), 180);
                }
              } else {
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = "high";
                  ctx.save();
                  ctx.translate(outW / 2, outH / 2);
                  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
                  if (isMirrored) ctx.scale(-1, 1);
                  ctx.drawImage(video, -rawW / 2, -rawH / 2, rawW, rawH);
                  ctx.restore();
                  applyLiveFilter(ctx, canvas.width, canvas.height, liveFilter, []);
                  const b64 = canvas.toDataURL("image/png", 1.0).split(",")[1];
                  quickPhotos.push(b64);
                  setFlash(true);
                  setTimeout(() => setFlash(false), 180);
                }
              }
            }

            currentShot += 1;
            if (currentShot < 4) {
              setTimeout(takeNextShot, 1200);
            } else {
              stopRecordingVideo();
              // Dispatch all 4 photos THEN navigate
              dispatch({ type: "SET_CAPTURED_PHOTOS", payload: quickPhotos });
              setTimeout(() => navigate("/photostrip"), 400);
            }
          } else {
            setCountdown(c);
          }
        }, 1000);
      };
      takeNextShot();
      return;
    }

    let c = countdownSecs;
    setCountdown(c);
    const id = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(id);
        setCountdown(null);
        capturePhoto();
        if (capturedPhotos.length + 1 >= targetCount) stopRecordingVideo();
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, [countdown, capturedPhotos.length, targetCount, countdownSecs, capturePhoto, mode, startRecordingVideo, stopRecordingVideo, navigate, rotation, isMirrored, liveFilter, dispatch]);

  const handleRetake = () => {
    setCapturedPhotos([]);
    dispatch({ type: "SET_SESSION_VIDEO", payload: null });
  };

  const handleProceed = () => {
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: capturedPhotos });
    navigate("/studio");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const photos: string[] = [];
    for (const file of Array.from(files)) {
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = (ev) => res((ev.target?.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      photos.push(b64);
    }
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: photos });
    navigate("/studio");
  };

  // Camera source label
  const cameraSourceLabel = phoneConnected
    ? "📱 HP Wireless"
    : devices.find((d) => d.deviceId === selectedDeviceId)?.label?.toLowerCase().includes("external")
    ? "🎥 External"
    : selectedDeviceId
    ? "💻 Kamera Aktif"
    : "💻 Laptop Cam";

  // CSS filter for video element (non-face filters)
  const videoCssFilter =
    liveFilter === "bw"
      ? "grayscale(100%) contrast(110%)"
      : liveFilter === "vintage"
      ? "sepia(60%) contrast(115%) brightness(95%)"
      : liveFilter === "dreamy"
      ? "brightness(110%) saturate(125%) contrast(95%)"
      : liveFilter === "face_beauty"
      ? "brightness(105%) contrast(103%)"
      : "none";

  const viewportStyle = {
    width: rotation % 180 !== 0 ? "calc(100vh - 56px)" : "100%",
    height: rotation % 180 !== 0 ? "100vw" : "100%",
    maxWidth: rotation % 180 !== 0 ? "calc(100vh - 56px)" : "100%",
    maxHeight: rotation % 180 !== 0 ? "100vw" : "100%",
    transform: `translate(-50%, -50%) rotate(${rotation}deg) ${isMirrored ? "scaleX(-1)" : ""}`,
    objectFit: fitMode === "cover" ? "cover" as const : "contain" as const,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full bg-black overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Video Viewfinder (hidden visually when face filter active, still needed for MediaPipe) ── */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute top-1/2 left-1/2 transition-all duration-200"
        style={{
          ...viewportStyle,
          objectFit: fitMode === "cover" ? "cover" : "contain",
          filter: videoCssFilter,
          // When face filter active: hide video visually, show render canvas instead
          opacity: FACE_FILTERS.includes(liveFilter) ? 0 : 1,
          pointerEvents: "none",
        }}
      />

      {/* ── Live Face Filter Render Canvas (replaces video when face filter active) ── */}
      <canvas
        ref={liveRenderCanvasRef}
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{
          ...viewportStyle,
          // canvas does not support objectFit — size it to match video display area
          // Cover mode: fill container, Contain: fit inside
          objectFit: fitMode === "cover" ? "cover" : "contain",
          opacity: FACE_FILTERS.includes(liveFilter) ? 1 : 0,
          transition: "opacity 0.2s",
          zIndex: 8,
        }}
      />

      {/* ── Face Scan Overlay Canvas (always visible when face filter active) ── */}
      {/* NOTE: overlay canvas uses NO CSS scaleX mirror — face coords are flipped manually in drawScanOverlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-1/2 left-1/2 pointer-events-none z-10"
        style={{
          // Same size/position as video but WITHOUT scaleX(-1) — text stays readable
          width: viewportStyle.width,
          height: viewportStyle.height,
          maxWidth: viewportStyle.maxWidth,
          maxHeight: viewportStyle.maxHeight,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          objectFit: fitMode === "cover" ? "cover" : "contain",
          opacity: needsFaceTracker ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />

      {/* ── Face Scan Status Badge (top-center, only when face filter active) ── */}
      {needsFaceTracker && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          {faceTrackerLoading ? (
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md border border-yellow-500/40 text-yellow-300 text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
              <span className="inline-block animate-spin">⟳</span>
              Memuat AI Face Detector...
            </div>
          ) : faceBoxes.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-green-500/50 text-green-300 text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              {faceBoxes.length} WAJAH TERDETEKSI
            </div>
          ) : faceTrackerReady ? (
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-yellow-500/40 text-yellow-300 text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping inline-block" />
              MEMINDAI WAJAH...
            </div>
          ) : null}
        </div>
      )}

      {/* Vignette Overlay */}
      {liveFilter === "vignette" && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.75) 100%)" }}
        />
      )}

      {/* face_spotlight live CSS approximation (darkens edges) */}
      {liveFilter === "face_spotlight" && (
        <div
          className="absolute inset-0 pointer-events-none z-[9]"
          style={{ background: "radial-gradient(ellipse 55% 65% at 50% 45%, transparent 0%, rgba(0,0,0,0.78) 100%)" }}
        />
      )}

      {/* Off-screen canvas for snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="absolute inset-0 bg-white z-30 pointer-events-none"
            initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* Error Fallback */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 gap-4 text-center p-6">
          <Camera size={56} className="text-gray-500" />
          <h2 className="text-white text-xl font-bold">Kamera Tidak Terdeteksi / Izin Diblokir</h2>
          <p className="text-gray-400 text-sm max-w-md">
            {!navigator?.mediaDevices?.getUserMedia
              ? "Browser memblokir kamera karena dibuka via IP HTTP lokal. Buka melalui http://localhost:5173"
              : "Pastikan webcam laptop atau kamera eksternal sudah terpasang dan izin kamera diizinkan."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {window.location.hostname !== "localhost" && (
              <button
                onClick={() => { window.location.href = window.location.href.replace(window.location.hostname, "localhost"); }}
                className="px-5 py-2.5 bg-rose-600 rounded-2xl text-white font-medium hover:bg-rose-700"
              >
                Buka via Localhost
              </button>
            )}
            <button onClick={() => setShowPhoneModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-2xl text-white font-medium hover:bg-white/20">
              <Smartphone size={18} /> Sambungkan Kamera HP
            </button>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-2xl text-white font-medium cursor-pointer hover:bg-white/20">
              <Upload size={18} /> Unggah Foto
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Top-Left: Shot counter + resolution + status */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/10">
          {mode === "quick" ? "⚡ QUICK MODE" : `${capturedPhotos.length} / ${targetCount} FOTO`}
        </div>
        {resolution && (
          <div className="bg-black/50 backdrop-blur-sm text-gray-300 text-xs font-mono px-2.5 py-1 rounded-full border border-white/10">
            {resolution}
          </div>
        )}
        {phoneConnected && (
          <div className="bg-emerald-600/90 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Smartphone size={13} /> HP Terhubung
          </div>
        )}
      </div>

      {/* Top-Right: Quick Actions */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setShowPhoneModal(true)}
          className={`px-3 py-2 rounded-full backdrop-blur-sm text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 ${
            phoneConnected ? "bg-emerald-600 text-white" : "bg-black/60 text-white hover:bg-black/80"
          }`}
          title="Koneksi Kamera HP"
        >
          <Smartphone size={16} />
          <span className="hidden sm:inline">Kamera HP</span>
        </button>

        <button
          onClick={() => setIsMirrored((prev) => !prev)}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            isMirrored ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title={isMirrored ? "Cermin: Aktif" : "Cermin: Mati"}
        >
          <FlipHorizontal size={18} />
        </button>

        {/* Flip front/back camera — works on mobile/phone camera */}
        <button
          onClick={handleFlipPhoneCamera}
          className="w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 bg-black/60 hover:bg-black/80"
          title="Ganti Kamera Depan/Belakang"
        >
          <RotateCcw size={18} />
        </button>

        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            rotation !== 0 ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title={`Putar Kamera (${rotation}°)`}
        >
          <RotateCw size={18} />
        </button>

        <button
          onClick={() => setFitMode((prev) => (prev === "cover" ? "contain" : "cover"))}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            fitMode === "contain" ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title={fitMode === "cover" ? "Mode: Penuh" : "Mode: Pas"}
        >
          {fitMode === "cover" ? <Maximize size={18} /> : <Minimize size={18} />}
        </button>

        <button
          onClick={() => setSidebarOpen((p) => !p)}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            sidebarOpen ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title="Pengaturan"
        >
          {sidebarOpen ? <X size={19} /> : <SlidersHorizontal size={18} />}
        </button>
      </div>

      {/* ── Right Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop — click anywhere outside to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[19] bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: 288, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 288, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute top-0 right-0 h-full w-72 z-20 bg-black/90 backdrop-blur-md flex flex-col gap-4 p-5 border-l border-white/10 overflow-y-auto"
            >
              {/* Header + close button */}
              <div className="flex items-center justify-between pt-2 pb-2 border-b border-white/10 flex-shrink-0">
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <SlidersHorizontal size={15} className="text-rose-500" /> Pengaturan
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  title="Tutup sidebar"
                >
                  <X size={14} />
                </button>
              </div>

              {/* ── Camera Connect Section ── */}
              <div>
                <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                  <Video size={13} className="text-rose-500" /> Koneksi Kamera
                </p>
                <div className="mb-2 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                  <span className="text-xs text-gray-400">Sumber aktif:</span>
                  <span className="text-xs font-semibold text-white">{cameraSourceLabel}</span>
                </div>
                <div className="flex gap-1.5 mb-2">
                  <select
                    value={phoneConnected ? "phone" : selectedDeviceId}
                    onChange={(e) => { if (e.target.value === "phone") setShowPhoneModal(true); else handleSelectCamera(e.target.value); }}
                    className="flex-1 bg-white/10 text-white text-xs rounded-xl p-2.5 border border-white/20 focus:outline-none focus:border-rose-500"
                  >
                    {phoneConnected && <option value="phone" className="bg-gray-900 text-emerald-400">📱 Kamera HP (Wireless)</option>}
                    {devices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId} className="bg-gray-900 text-white">
                        {device.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                    {devices.length === 0 && <option disabled className="bg-gray-900 text-gray-500">Tidak ada kamera terdeteksi</option>}
                  </select>
                  <button onClick={refreshDevices} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors flex-shrink-0" title="Refresh">
                    <RefreshCw size={14} />
                  </button>
                </div>
                <button
                  onClick={() => setShowPhoneModal(true)}
                  className={`w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors mb-1.5 ${phoneConnected ? "bg-emerald-600/80 text-white hover:bg-emerald-600" : "bg-white/10 hover:bg-white/20 text-white"}`}
                >
                  <Smartphone size={14} className={phoneConnected ? "text-white" : "text-rose-400"} />
                  {phoneConnected ? "✓ HP Terhubung (Klik untuk info)" : "📱 Sambungkan HP (WiFi)"}
                </button>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold mb-1"><Usb size={12} className="text-blue-400" /> USB / Capture Card</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Pasang <strong className="text-gray-300">DroidCam</strong> atau <strong className="text-gray-300">Iriun Webcam</strong> di HP + PC, lalu hubungkan via USB.</p>
                </div>
              </div>

              {/* ── Filter Section ── */}
              <div>
                <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                  <SlidersHorizontal size={13} className="text-rose-500" /> Filter Kamera
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">Warna & Efek</p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {LIVE_FILTERS.filter(f => !FACE_FILTERS.includes(f.id)).map((f) => (
                    <button key={f.id} onClick={() => setLiveFilter(f.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${liveFilter === f.id ? "bg-rose-600 text-white shadow-sm" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}>
                      <span className="text-sm">{f.emoji}</span><span>{f.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">🤖 AI Face Filter</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {LIVE_FILTERS.filter(f => FACE_FILTERS.includes(f.id)).map((f) => (
                    <button key={f.id} onClick={() => setLiveFilter(f.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${liveFilter === f.id ? "bg-green-600 text-white shadow-sm border-green-400/50" : "bg-white/5 text-green-300 hover:bg-green-900/40 border-green-800/40"}`}>
                      <span className="text-sm">{f.emoji}</span><span>{f.label}</span>
                    </button>
                  ))}
                </div>
                {FACE_FILTERS.includes(liveFilter) && <p className="text-[10px] text-green-600/80 mt-2 font-mono">🤖 AI Face Aktif — scan wajah berjalan</p>}

                {/* Blur strength slider — only shown for blur bg filter */}
                {(liveFilter === "face_blur_bg" || liveFilter === "face_soft_blur") && (
                  <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-300 font-semibold">🫧 Kekuatan Blur</span>
                      <span className="text-xs font-mono text-green-400 w-6 text-right">{blurStrength}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={blurStrength}
                      onChange={(e) => setBlurStrength(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-green-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                      <span>Halus</span>
                      <span>Kuat</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Face Tracker Section ── */}
              <div>
                <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                  <Scan size={13} className="text-rose-500" /> Face Tracker
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Overlay Deteksi Wajah</span>
                    <button onClick={() => setShowFaceOverlay((p) => !p)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${showFaceOverlay ? "bg-green-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}>
                      {showFaceOverlay ? "ON" : "OFF"}
                    </button>
                  </div>
                  {faceTrackerLoading && <p className="text-xs text-yellow-400 flex items-center gap-1.5"><span className="animate-spin inline-block">⟳</span> Memuat model AI...</p>}
                  {faceTrackerReady && faceBoxes.length > 0 && <p className="text-xs text-green-400">✓ {faceBoxes.length} wajah terdeteksi</p>}
                  {faceTrackerReady && faceBoxes.length === 0 && showFaceOverlay && <p className="text-xs text-gray-500">Tidak ada wajah di frame</p>}
                  <p className="text-xs text-gray-600">Filter AI otomatis aktifkan scanner wajah.</p>
                </div>
              </div>

              {/* ── Mode Selector ── */}
              <div>
                <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                  <Layers size={13} className="text-rose-500" /> Mode Foto
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "single", label: "1 Foto (Single)" },
                    { id: "burst3", label: "3 Foto (Burst)" },
                    { id: "burst4", label: "4 Foto (Photostrip)" },
                    { id: "quick", label: "⚡ Quick Mode (1-Sentuhan)" },
                  ].map((m) => (
                    <button key={m.id} onClick={() => { setMode(m.id as Mode); setCapturedPhotos([]); }}
                      className={`py-2 px-3 rounded-xl text-xs font-medium text-left transition-all ${mode === m.id ? "bg-rose-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Timer ── */}
              {mode !== "quick" && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                    <Clock size={13} className="text-rose-500" /> Timer Hitung Mundur
                  </p>
                  <div className="flex gap-2">
                    {COUNTDOWN_OPTIONS.map((s) => (
                      <button key={s} onClick={() => setCountdownSecs(s)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${countdownSecs === s ? "bg-rose-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}>
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Upload ── */}
              <div className="mt-auto pt-4 border-t border-white/10">
                <label className="flex items-center justify-center gap-2 py-2.5 w-full rounded-xl bg-white/10 text-gray-200 text-xs font-medium cursor-pointer hover:bg-white/20 transition-colors">
                  <Upload size={15} /> Unggah Berkas Foto
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

            {/* ── Countdown Overlay ── */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <span className="text-[10rem] font-black text-white drop-shadow-2xl leading-none select-none">
              {countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shutter Button ── */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
        <button
          onClick={handleShutter}
          disabled={countdown !== null || (mode !== "quick" && capturedPhotos.length >= targetCount)}
          className="w-20 h-20 rounded-full bg-rose-600 shadow-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-700 active:scale-95 transition-all border-4 border-white/30"
          title="Ambil Foto"
        >
          {mode === "quick" ? <Zap size={34} className="text-white" /> : <Camera size={34} className="text-white" />}
        </button>
      </div>

      {/* ── Thumbnail Strip ── */}
      <AnimatePresence>
        {capturedPhotos.length > 0 && mode !== "quick" && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 z-25 bg-black/90 border-t border-white/10 py-3 px-4"
          >
            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {capturedPhotos.map((photo, i) => (
                  <img
                    key={i}
                    src={`data:image/png;base64,${photo}`}
                    alt={`Foto ${i + 1}`}
                    className="h-14 w-14 object-cover rounded-lg border-2 border-rose-600 flex-shrink-0"
                  />
                ))}
                {Array.from({ length: Math.max(0, targetCount - capturedPhotos.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-14 w-14 rounded-lg border-2 border-dashed border-white/20 flex-shrink-0 flex items-center justify-center">
                    <Camera size={16} className="text-white/30" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleRetake} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 rounded-xl text-xs font-medium text-white hover:bg-white/20 transition-colors">
                  <RotateCcw size={14} /> Ulang
                </button>
                {capturedPhotos.length >= targetCount && (
                  <button onClick={handleProceed} className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 rounded-xl text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm">
                    Lanjut ke Studio <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phone Modal ── */}
      <AnimatePresence>
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-white/10 text-white rounded-3xl max-w-md w-full p-6 relative"
            >
              <button onClick={() => setShowPhoneModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white p-2">
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 mb-2 text-rose-500 font-semibold text-sm">
                <Smartphone size={18} /> Sambungkan Kamera HP
              </div>
              <h3 className="text-lg font-bold mb-4">Gunakan HP Sebagai Kamera Booth</h3>

              {phoneConnected ? (
                <div className="text-center py-6 bg-emerald-950/40 rounded-2xl border border-emerald-500/30 mb-4">
                  <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-white">HP Anda Sudah Terhubung!</p>
                  <p className="text-xs text-gray-300 mt-1">Live video stream dari kamera HP sedang aktif.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center bg-black/50 p-4 rounded-2xl border border-white/10 mb-4">
                  {phoneQrUrl ? (
                    <img src={phoneQrUrl} alt="QR Code Kamera HP" className="w-48 h-48 rounded-xl bg-white p-2" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">Membuat QR Code...</div>
                  )}
                  <p className="text-xs text-gray-300 text-center mt-3">
                    Scan QR Code ini menggunakan kamera smartphone Anda. Kamera HP akan otomatis tersambung ke layar booth.
                  </p>
                </div>
              )}

              <div className="bg-white/5 p-3 rounded-xl text-xs text-gray-400 space-y-1 mb-4">
                <p className="font-semibold text-white">Alternatif Kabel USB (0-Latency HD):</p>
                <p>1. Pasang aplikasi <strong>DroidCam</strong> atau <strong>Iriun Webcam</strong> di HP dan PC.</p>
                <p>2. Hubungkan HP via USB, kamera HP akan langsung muncul di dropdown <em>Sumber Kamera</em>.</p>
              </div>

              <button
                onClick={() => setShowPhoneModal(false)}
                className="w-full py-3 bg-rose-600 rounded-xl text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                {phoneConnected ? "Gunakan Kamera HP Ini" : "Tutup"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
