import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import type { Sticker, PhotostripLayout } from "../types";
import {
  ArrowRight, Loader2, ZoomIn, Frame, Sparkles,
  Type, Palette, Move, RotateCcw, X, Camera, SlidersHorizontal,
  Upload, GripVertical, RotateCw
} from "lucide-react";
import {
  FRAME_THEMES,
  STICKER_CATEGORIES,
  FONT_OPTIONS,
  type FrameTheme
} from "../constants/frameThemes";

const DEMO_POSES = [
  `${import.meta.env.BASE_URL}demo/pose1.jpg`,
  `${import.meta.env.BASE_URL}demo/pose2.jpg`,
  `${import.meta.env.BASE_URL}demo/pose3.jpg`,
  `${import.meta.env.BASE_URL}demo/pose4.jpg`,
];

/* ── 4. TEXT COLOR PALETTE ── */
const TEXT_COLORS = [
  { id: "auto", name: "Otomatis (Kontras)", value: "auto" },
  { id: "dark", name: "Hitam Pekat", value: "#1A1A1A" },
  { id: "white", name: "Putih Bersih", value: "#FFFFFF" },
  { id: "gold", name: "Gold Emas", value: "#D4AF37" },
  { id: "rose", name: "Crimson Rose", value: "#E11D48" },
  { id: "slate", name: "Slate Grey", value: "#64748B" },
  { id: "pink", name: "Baby Pink", value: "#F472B6" },
];

export default function PhotostripEditor() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  // Active Left Sidebar Tab: "frame" | "stickers" | "adjust"
  const [leftTab, setLeftTab] = useState<"frame" | "stickers" | "adjust">("frame");

  // Frame Theme Selection
  const [selectedTheme, setSelectedTheme] = useState<FrameTheme>(() => {
    if (state.photostripFrame?.themeId) {
      const byId = FRAME_THEMES.find((f) => f.id === state.photostripFrame.themeId);
      if (byId) return byId;
    }
    const found = FRAME_THEMES.find((f) => f.color.toLowerCase() === state.photostripFrame.color.toLowerCase());
    return found || FRAME_THEMES[0];
  });
  const [frameCategory, setFrameCategory] = useState<string>("all");

  // Sticker State
  const [stickerCategory, setStickerCategory] = useState<string>("cute");
  const [stickerSize, setStickerSize] = useState<number>(48);
  const [stickers, setStickers] = useState<Sticker[]>(state.photostripStickers || []);

  // Sticker drag & selection state
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    id: string;
    startPointerX: number;
    startPointerY: number;
    startStickerX: number;
    startStickerY: number;
  } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Multi-Font & Text Customization (Mix Fonts)
  const [showHeader, setShowHeader] = useState(true);
  const [headerText, setHeaderText] = useState("PHOTOBOOTH");
  const [headerFont, setHeaderFont] = useState(FONT_OPTIONS[3].family); // Playfair
  const [headerSize, setHeaderSize] = useState(36);

  const [caption, setCaption] = useState(state.captionText || "");
  const [captionFont, setCaptionFont] = useState(FONT_OPTIONS[0].family); // Dancing Script
  const [captionSize, setCaptionSize] = useState(26);

  const [showDate, setShowDate] = useState(true);
  const [dateFont, setDateFont] = useState(FONT_OPTIONS[9].family); // Special Elite (Typewriter)
  const [dateSize, setDateSize] = useState(20);
  const [dateCustomText, setDateCustomText] = useState(() =>
    new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  );

  const [textColorChoice, setTextColorChoice] = useState<string>("auto");

  // Photo Crop/Pan/Zoom Adjustments
  const [zoom, setZoom] = useState(state.photoZoom || 1.0);
  const [offsetX, setOffsetX] = useState(state.photoOffsetX || 0);
  const [offsetY, setOffsetY] = useState(state.photoOffsetY || 0);

  // Border thickness & layout controls ("border putihnya ketebelan" -> slim modern Korean photobooth)
  const [borderPad, setBorderPad] = useState<number>(16); // Default 16px (Slim & Sleek Korean Photobooth)
  const [photoGap, setPhotoGap] = useState<number>(10); // Default 10px
  const [photoRadius, setPhotoRadius] = useState<number>(6); // Default 6px
  const [showPhotoBorder, setShowPhotoBorder] = useState<boolean>(false); // Default OFF so no extra thick white outlines

  const rawPhotos = state.filteredPhotos.length > 0 ? state.filteredPhotos : state.capturedPhotos;
  const isDemo = rawPhotos.length === 0;
  const photos = isDemo ? DEMO_POSES : rawPhotos;
  const layout = state.photostripLayout;

  /* ── Sticker Actions ── */
  const addSticker = (emoji: string) => {
    const newSticker: Sticker = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      x: Math.random() * 50 + 25,
      y: Math.random() * 60 + 20,
      size: stickerSize,
    };
    const updated = [...stickers, newSticker];
    setStickers(updated);
    dispatch({ type: "SET_STICKERS", payload: updated });
  };

  const removeSticker = (id: string) => {
    const updated = stickers.filter((s) => s.id !== id);
    setStickers(updated);
    dispatch({ type: "SET_STICKERS", payload: updated });
  };

  const clearAllStickers = () => {
    setStickers([]);
    dispatch({ type: "SET_STICKERS", payload: [] });
  };

  /* ── Sticker Drag Handlers (pointer events on overlay) ── */
  const handleStickerPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedStickerId(id);
    const s = stickers.find((st) => st.id === id);
    if (!s) return;
    dragStateRef.current = {
      id,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startStickerX: s.x,
      startStickerY: s.y,
    };
  }, [stickers]);

  const handleStickerPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag || !previewContainerRef.current) return;
    const container = previewContainerRef.current;
    const rect = container.getBoundingClientRect();
    const dx = ((e.clientX - drag.startPointerX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startPointerY) / rect.height) * 100;
    const newX = Math.max(2, Math.min(98, drag.startStickerX + dx));
    const newY = Math.max(2, Math.min(98, drag.startStickerY + dy));
    setStickers((prev) =>
      prev.map((s) => s.id === drag.id ? { ...s, x: newX, y: newY } : s)
    );
  }, []);

  const handleStickerPointerUp = useCallback(() => {
    if (!dragStateRef.current) return;
    const id = dragStateRef.current.id;
    dragStateRef.current = null;
    // Sync final position to store
    setStickers((prev) => {
      dispatch({ type: "SET_STICKERS", payload: prev });
      return prev;
    });
    // Keep selected for resize/rotate controls
    setSelectedStickerId(id);
  }, [dispatch]);

  const handleStickerRotate = useCallback((id: string, delta: number) => {
    setStickers((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, rotation: ((s.rotation ?? 0) + delta + 360) % 360 } : s
      );
      dispatch({ type: "SET_STICKERS", payload: updated });
      return updated;
    });
  }, [dispatch]);

  const handleStickerResize = useCallback((id: string, delta: number) => {
    setStickers((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, size: Math.max(16, Math.min(120, (s.size ?? 48) + delta)) } : s
      );
      dispatch({ type: "SET_STICKERS", payload: updated });
      return updated;
    });
  }, [dispatch]);

  /* ── Custom Sticker Upload ── */
  const handleCustomStickerUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;
        const newSticker: Sticker = {
          id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          emoji: "🖼️",
          imageUrl: dataUrl,
          x: Math.random() * 50 + 25,
          y: Math.random() * 50 + 25,
          size: stickerSize,
        };
        setStickers((prev) => {
          const updated = [...prev, newSticker];
          dispatch({ type: "SET_STICKERS", payload: updated });
          return updated;
        });
        setSelectedStickerId(newSticker.id);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = ""; // reset so same file can be re-uploaded
  }, [stickerSize, dispatch]);

  /* ── 300 DPI Standard Photostrip Canvas Drawing ── */
  const drawPhotostrip = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;
    setLoading(true);

    // Wait until Google Web Fonts are ready
    if (document.fonts) {
      await document.fonts.ready;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let canvasWidth = 600;
    let canvasHeight = 1800;
    let count = 4;

    if (layout === "strip3") {
      canvasWidth = 600;
      canvasHeight = 1800;
      count = 3;
    } else if (layout === "grid2x2") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 4;
    } else if (layout === "grid2x2portrait") {
      // Portrait 2×2 grid — 2 columns × 2 rows, each slot is portrait (3:4 ratio)
      // Canvas: 1200×2000 → each slot ~560×860 (portrait, taller than wide)
      canvasWidth = 1200;
      canvasHeight = 2000;
      count = 4;
    } else if (layout === "singleCard") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 1;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Scale factor relative to standard 600px width (1.0 for strips, 2.0 for grid2x2/singleCard)
    const scale = canvasWidth / 600;
    const pad = Math.round(borderPad * scale);
    const scaledGap = Math.round(photoGap * scale);

    const topH = showHeader ? Math.round(96 * scale) : Math.round(24 * scale);
    const bottomH = caption || showDate ? Math.round(130 * scale) : Math.round(28 * scale);

    const loadImg = (srcOrB64: string): Promise<HTMLImageElement> =>
      new Promise((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const src =
          srcOrB64.startsWith("data:") || srcOrB64.startsWith("http") || srcOrB64.startsWith("/") || srcOrB64.startsWith(".")
            ? srcOrB64
            : `data:image/png;base64,${srcOrB64}`;
        img.onload = () => res(img);
        img.onerror = () => {
          const c = document.createElement("canvas");
          c.width = 400; c.height = 300;
          const cx = c.getContext("2d")!;
          cx.fillStyle = "#fecdd3";
          cx.fillRect(0, 0, 400, 300);
          const fallback = new Image();
          fallback.onload = () => res(fallback);
          fallback.src = c.toDataURL();
        };
        img.src = src;
      });

    // ── 1. Draw Frame Background ──
    if (selectedTheme.type === "image" && selectedTheme.imageUrl) {
      // AI Illustrated Aesthetic Frame Background (Gemini) - Cover Crop (no distortion)
      const frameImg = await loadImg(`${import.meta.env.BASE_URL}${selectedTheme.imageUrl}`);
      const imgRatio = frameImg.naturalWidth / frameImg.naturalHeight;
      const canvasRatio = canvas.width / canvas.height;
      let sW = frameImg.naturalWidth;
      let sH = frameImg.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (imgRatio > canvasRatio) {
        sW = frameImg.naturalHeight * canvasRatio;
        sx = (frameImg.naturalWidth - sW) / 2;
      } else {
        sH = frameImg.naturalWidth / canvasRatio;
        sy = (frameImg.naturalHeight - sH) / 2;
      }
      ctx.drawImage(frameImg, sx, sy, sW, sH, 0, 0, canvas.width, canvas.height);
    } else if (selectedTheme.type === "film") {
      // Authentic 35mm film strip with sprocket holes
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const holeW = 14, holeH = 22, holeR = 4;
      const holeStep = 50;
      ctx.fillStyle = "#F8FAFC";
      for (let hy = 16; hy < canvas.height - 16; hy += holeStep) {
        ctx.beginPath();
        ctx.roundRect(pad > 26 ? 8 : 4, hy, holeW, holeH, holeR);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(canvas.width - (pad > 26 ? 22 : 18), hy, holeW, holeH, holeR);
        ctx.fill();
      }
    } else if (selectedTheme.type === "gradient" && selectedTheme.gradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, selectedTheme.gradient[0]);
      grad.addColorStop(1, selectedTheme.gradient[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (selectedTheme.type === "pattern") {
      ctx.fillStyle = selectedTheme.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (selectedTheme.pattern === "polka") {
        ctx.fillStyle = selectedTheme.borderColor || "rgba(244, 114, 182, 0.35)";
        const step = 42;
        for (let py = 16; py < canvas.height; py += step) {
          for (let px = 16; px < canvas.width; px += step) {
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (selectedTheme.pattern === "checker") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        const sq = 32;
        for (let py = 0; py < canvas.height; py += sq) {
          for (let px = 0; px < canvas.width; px += sq) {
            if ((Math.floor(px / sq) + Math.floor(py / sq)) % 2 === 0) {
              ctx.fillRect(px, py, sq, sq);
            }
          }
        }
      } else if (selectedTheme.pattern === "grid") {
        // Delicate, soft notebook grid lines
        ctx.strokeStyle = "rgba(100, 116, 139, 0.16)";
        ctx.lineWidth = 1;
        const gStep = 32;
        ctx.beginPath();
        for (let px = gStep; px < canvas.width; px += gStep) {
          ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
        }
        for (let py = gStep; py < canvas.height; py += gStep) {
          ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
        }
        ctx.stroke();
      } else if (selectedTheme.pattern === "hearts") {
        ctx.fillStyle = "rgba(251, 113, 133, 0.22)";
        ctx.font = "18px serif";
        ctx.textAlign = "center";
        for (let py = 30; py < canvas.height; py += 64) {
          for (let px = 30; px < canvas.width; px += 64) {
            ctx.fillText("♥", px, py);
          }
        }
      }
    } else {
      // Solid color
      ctx.fillStyle = selectedTheme.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (selectedTheme.hasDoubleBorder) {
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
      }
    }

    // Resolve Text Color (auto or custom choice)
    let resolvedTextColor: string;
    if (textColorChoice !== "auto") {
      resolvedTextColor = textColorChoice;
    } else if (selectedTheme.textColor) {
      resolvedTextColor = selectedTheme.textColor;
    } else {
      const isDark = selectedTheme.color === "#18181B" || selectedTheme.color === "#334155" || selectedTheme.type === "film";
      resolvedTextColor = isDark ? "#FFFFFF" : "#1A1A1A";
    }

    // ── 2. Draw Header (Custom Font with contrast halo & layout scale) ──
    if (showHeader && headerText) {
      const effectiveHeaderSize = Math.round(headerSize * scale);
      ctx.save();
      ctx.font = `bold ${effectiveHeaderSize}px ${headerFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const isLight = resolvedTextColor.toLowerCase() === "#ffffff" || resolvedTextColor.toLowerCase() === "#fff";
      const hy = Math.round(topH / 2);

      // Contrast halo / shadow so text is 100% visible on any background (chrome, dark, pastel)
      ctx.shadowColor = isLight ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
      ctx.shadowBlur = Math.round(6 * scale);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(1.5 * scale);

      // Subtle stroke outline for guaranteed edge definition
      ctx.lineWidth = Math.round(2.5 * scale);
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
      ctx.strokeText(headerText, canvas.width / 2, hy);

      // Main text fill
      ctx.fillStyle = resolvedTextColor;
      ctx.fillText(headerText, canvas.width / 2, hy);
      ctx.restore();
    }

    // ── 3. Calculate Photo Dimensions (Dynamic Grid Math) ──
    let photoW = canvas.width - pad * 2;
    let photoH = 390;

    if (layout === "strip4") {
      const availH = canvas.height - topH - bottomH - 3 * scaledGap;
      photoH = Math.floor(availH / 4);
    } else if (layout === "strip3") {
      const availH = canvas.height - topH - bottomH - 2 * scaledGap;
      photoH = Math.floor(availH / 3);
    } else if (layout === "grid2x2") {
      const colGap = Math.round(scaledGap * 1.2);
      photoW = Math.floor((canvas.width - pad * 2 - colGap) / 2);
      const availH = canvas.height - topH - bottomH - colGap;
      photoH = Math.floor(availH / 2);
    } else if (layout === "grid2x2portrait") {
      // Portrait 2×2: 2 columns, each slot portrait (tall)
      const colGap = Math.round(scaledGap * 1.2);
      photoW = Math.floor((canvas.width - pad * 2 - colGap) / 2);
      const availH = canvas.height - topH - bottomH - colGap;
      photoH = Math.floor(availH / 2);
    } else if (layout === "singleCard") {
      photoW = canvas.width - pad * 2;
      photoH = canvas.height - topH - bottomH;
    }

    // ── 4. Load & Draw Photos with Aspect-Fill (Cover Crop) & Adjustments ──
    const usedPhotos = photos.slice(0, count);
    const imgEls = await Promise.all(usedPhotos.map(loadImg));

    imgEls.forEach((img, i) => {
      let x = pad;
      let y = topH + i * (photoH + scaledGap);

      if (layout === "grid2x2" || layout === "grid2x2portrait") {
        const colGap = Math.round(scaledGap * 1.2);
        const col = i % 2;
        const row = Math.floor(i / 2);
        x = pad + col * (photoW + colGap);
        y = topH + row * (photoH + colGap);
      } else if (layout === "singleCard") {
        x = pad;
        y = topH;
      }

      ctx.save();
      ctx.beginPath();
      const effectiveRadius = Math.round(photoRadius * scale);
      ctx.roundRect(x, y, photoW, photoH, effectiveRadius);
      ctx.clip();

      // Aspect-fill (cover crop) to preserve original aspect ratio without distortion
      const targetRatio = photoW / photoH;
      const imgRatio = img.width / img.height;
      let baseW = img.width;
      let baseH = img.height;
      if (imgRatio > targetRatio) {
        baseW = img.height * targetRatio;
      } else {
        baseH = img.width / targetRatio;
      }

      const sWidth = baseW / zoom;
      const sHeight = baseH / zoom;
      const maxOffsetX = img.width - sWidth;
      const maxOffsetY = img.height - sHeight;
      // Headroom-biased portrait crop (preserves hair and head, crops lower torso)
      const defaultYOffset = maxOffsetY * 0.22;
      const sX = Math.max(0, Math.min(maxOffsetX, (img.width - sWidth) / 2 + (offsetX / 100) * (maxOffsetX / 2)));
      const sY = Math.max(0, Math.min(maxOffsetY, defaultYOffset + (offsetY / 100) * (maxOffsetY / 2)));

      ctx.drawImage(img, sX, sY, sWidth, sHeight, x, y, photoW, photoH);
      ctx.restore();

      // Delicate photo card stroke/border
      if (showPhotoBorder) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, photoW, photoH, effectiveRadius);
        ctx.strokeStyle =
          selectedTheme.type === "image" || selectedTheme.color === "#18181B"
            ? "rgba(255, 255, 255, 0.4)"
            : "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = Math.round(1 * scale);
        ctx.stroke();
        ctx.restore();
      }
    });

    // ── 5. Draw Themed Stickers ──
    for (const s of stickers) {
      const effectiveStickerSize = Math.round((s.size || 48) * scale);
      const sx = (s.x / 100) * canvas.width;
      const sy = (s.y / 100) * canvas.height;
      const rot = ((s.rotation ?? 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(sx, sy);
      if (rot !== 0) ctx.rotate(rot);

      if (s.imageUrl) {
        // Custom uploaded sticker: preload then draw
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, -effectiveStickerSize / 2, -effectiveStickerSize / 2, effectiveStickerSize, effectiveStickerSize);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = s.imageUrl!;
        });
      } else {
        // Emoji sticker
        ctx.font = `${effectiveStickerSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.emoji, 0, 0);
      }

      ctx.restore();
    }

    // ── 6. Draw Footer: Caption & Date (Separate Mixed Fonts with contrast halo!) ──
    if (caption || showDate) {
      const footerStartY = canvas.height - bottomH;
      const fy = footerStartY + Math.round(bottomH / 2) - Math.round(4 * scale);
      const effectiveCaptionSize = Math.round(captionSize * scale);
      const effectiveDateSize = Math.round(dateSize * scale);
      const isLight = resolvedTextColor.toLowerCase() === "#ffffff" || resolvedTextColor.toLowerCase() === "#fff";

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = isLight ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
      ctx.shadowBlur = Math.round(5 * scale);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(1.5 * scale);

      if (caption && showDate) {
        // Caption
        ctx.font = `bold ${effectiveCaptionSize}px ${captionFont}`;
        ctx.lineWidth = Math.round(2 * scale);
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
        ctx.strokeText(caption, canvas.width / 2, fy - Math.round(16 * scale));
        ctx.fillStyle = resolvedTextColor;
        ctx.fillText(caption, canvas.width / 2, fy - Math.round(16 * scale));

        // Date
        ctx.font = `${effectiveDateSize}px ${dateFont}`;
        ctx.lineWidth = Math.round(1.5 * scale);
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
        ctx.strokeText(dateCustomText, canvas.width / 2, fy + Math.round(16 * scale));
        ctx.fillStyle = resolvedTextColor;
        ctx.fillText(dateCustomText, canvas.width / 2, fy + Math.round(16 * scale));
      } else if (caption) {
        ctx.font = `bold ${effectiveCaptionSize}px ${captionFont}`;
        ctx.lineWidth = Math.round(2 * scale);
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
        ctx.strokeText(caption, canvas.width / 2, fy);
        ctx.fillStyle = resolvedTextColor;
        ctx.fillText(caption, canvas.width / 2, fy);
      } else if (showDate) {
        ctx.font = `${effectiveDateSize}px ${dateFont}`;
        ctx.lineWidth = Math.round(1.5 * scale);
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
        ctx.strokeText(dateCustomText, canvas.width / 2, fy);
        ctx.fillStyle = resolvedTextColor;
        ctx.fillText(dateCustomText, canvas.width / 2, fy);
      }

      // Authentic Korean photobooth micro-stamp at the very bottom
      const microStampSize = Math.round(10 * scale);
      ctx.font = `${microStampSize}px monospace`;
      ctx.fillStyle = resolvedTextColor;
      ctx.globalAlpha = 0.55;
      ctx.fillText("✦ LIFE 4 CUTS • PCKV BOOTH ✦", canvas.width / 2, canvas.height - Math.round(16 * scale));
      ctx.restore();
    }

    dispatch({
      type: "SET_PHOTOSTRIP_RESULT",
      payload: canvas.toDataURL("image/png").split(",")[1],
    });
    setLoading(false);
  }, [
    photos, layout, selectedTheme, stickers, caption, captionFont, captionSize,
    showHeader, headerText, headerFont, headerSize, showDate, dateFont, dateSize,
    dateCustomText, textColorChoice, zoom, offsetX, offsetY, borderPad, photoGap,
    photoRadius, showPhotoBorder, dispatch
  ]);

  useEffect(() => {
    if (photos.length > 0) {
      drawPhotostrip();
    }
  }, [drawPhotostrip, photos.length]);

  const handleProceed = async () => {
    if (isDemo) {
      try {
        const b64List = await Promise.all(
          DEMO_POSES.map(async (url) => {
            return new Promise<string>((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.naturalWidth || 640;
                c.height = img.naturalHeight || 480;
                const ctx = c.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                resolve(c.toDataURL("image/jpeg", 0.92).split(",")[1]);
              };
              img.onerror = () => resolve("");
              img.src = url;
            });
          })
        );
        const valid = b64List.filter(Boolean);
        if (valid.length > 0) {
          dispatch({ type: "SET_CAPTURED_PHOTOS", payload: valid });
        }
      } catch (err) {
        console.warn("Failed to convert demo poses:", err);
      }
    }
    navigate("/result");
  };

  const filteredThemes = frameCategory === "all"
    ? FRAME_THEMES
    : FRAME_THEMES.filter((f) => f.category === frameCategory);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] flex flex-col lg:flex-row"
    >
      {/* ── LEFT PANEL: Frame, Stickers, and Slot Adjustments ── */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col max-h-[calc(100vh-56px)] shadow-xs">
        {/* Top Tab Bar */}
        <div className="flex border-b border-gray-200 p-2 gap-1 bg-gray-50">
          <button
            onClick={() => setLeftTab("frame")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              leftTab === "frame"
                ? "bg-white text-rose-600 shadow-xs border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Frame size={14} /> Bingkai
          </button>
          <button
            onClick={() => setLeftTab("stickers")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              leftTab === "stickers"
                ? "bg-white text-rose-600 shadow-xs border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Sparkles size={14} /> Stiker
          </button>
          <button
            onClick={() => setLeftTab("adjust")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              leftTab === "adjust"
                ? "bg-white text-rose-600 shadow-xs border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Move size={14} /> Posisi
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          {/* ── TAB 1: FRAME & THEMES ── */}
          {leftTab === "frame" && (
            <>
              {/* Template Layout */}
              <div>
                <label className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2 block">
                  Pilih Tata Letak (Layout)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "strip4", label: "Strip 4 Foto", sub: "4 foto vertikal" },
                    { key: "strip3", label: "Strip 3 Foto", sub: "3 foto vertikal" },
                    { key: "grid2x2", label: "Grid 2×2", sub: "2×2 kotak" },
                    { key: "grid2x2portrait", label: "Grid 2×2 Potret", sub: "2×2 portrait" },
                    { key: "singleCard", label: "Kartu 1 Foto", sub: "1 foto besar" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => dispatch({ type: "SET_LAYOUT", payload: t.key as PhotostripLayout })}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all leading-tight ${
                        layout === t.key
                          ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div>{t.label}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${layout === t.key ? "text-rose-400" : "text-gray-400"}`}>{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Category Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Tema Bingkai ({FRAME_THEMES.length} Pilihan)
                  </label>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {[
                    { key: "all", label: "Semua" },
                    { key: "ai_art", label: "✨ Ilustrasi AI" },
                    { key: "klasik", label: "Klasik" },
                    { key: "pastel", label: "Pastel" },
                    { key: "gradient", label: "Gradient" },
                    { key: "vintage", label: "Vintage" },
                    { key: "pattern", label: "Motif" },
                  ].map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setFrameCategory(c.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        frameCategory === c.key
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Frame Themes Grid */}
                <div className="grid grid-cols-2 gap-2 max-h-[32vh] overflow-y-auto pr-1">
                  {filteredThemes.map((theme) => {
                    const isSelected = selectedTheme.id === theme.id;
                    const bgStyle: React.CSSProperties =
                      theme.type === "image" && theme.imageUrl
                        ? {
                            backgroundImage: `url(${import.meta.env.BASE_URL}${theme.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : theme.type === "gradient" && theme.gradient
                        ? { background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})` }
                        : { backgroundColor: theme.color };

                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedTheme(theme);
                          dispatch({ type: "SET_FRAME", payload: { color: theme.color, themeId: theme.id } });
                        }}
                        className={`p-2 rounded-2xl border-2 text-left flex flex-col gap-1.5 transition-all relative overflow-hidden ${
                          isSelected
                            ? "border-rose-600 ring-2 ring-rose-300 shadow-sm bg-rose-50/20"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div
                          className="w-full h-10 rounded-xl shadow-inner border border-black/10 flex items-center justify-center relative overflow-hidden"
                          style={bgStyle}
                        >
                          {theme.badge && (
                            <span className="text-[9px] font-bold text-white bg-rose-600/90 px-1.5 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
                              {theme.badge}
                            </span>
                          )}
                          {theme.type === "film" && (
                            <span className="text-[9px] font-mono font-bold text-white tracking-widest bg-black/50 px-1 rounded">
                              🎞️ 35MM
                            </span>
                          )}
                          {theme.type === "pattern" && (
                            <span className="text-[10px] font-bold text-gray-800 bg-white/80 px-1.5 py-0.5 rounded-md">
                              {theme.pattern}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-800 truncate">{theme.name}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-rose-600 flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── BORDER THICKNESS & GAP CONTROLS ("bordernya ketebelan") ── */}
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-rose-600" /> Ketebalan Border
                  </label>
                  <span className="text-[11px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    {borderPad}px
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: "Tipis", pad: 10, gap: 6, rad: 4 },
                    { label: "Korea", pad: 16, gap: 10, rad: 6 },
                    { label: "Sedang", pad: 22, gap: 14, rad: 8 },
                    { label: "Tebal", pad: 30, gap: 18, rad: 10 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setBorderPad(preset.pad);
                        setPhotoGap(preset.gap);
                        setPhotoRadius(preset.rad);
                      }}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold text-center border transition-all ${
                        borderPad === preset.pad
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Sliders */}
                <div className="space-y-2 pt-1 text-xs text-gray-600">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Margin Tepi Bingkai</span>
                      <span className="font-mono font-bold text-gray-800">{borderPad}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="48"
                      step="2"
                      value={borderPad}
                      onChange={(e) => setBorderPad(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Jarak Antar Foto (Gap)</span>
                      <span className="font-mono font-bold text-gray-800">{photoGap}px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="28"
                      step="2"
                      value={photoGap}
                      onChange={(e) => setPhotoGap(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Lengkungan Sudut Foto</span>
                      <span className="font-mono font-bold text-gray-800">{photoRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="2"
                      value={photoRadius}
                      onChange={(e) => setPhotoRadius(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  {/* Photo Outline Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                    <span className="text-[11px] font-medium text-gray-700">Garis Tepi Foto (Outline)</span>
                    <button
                      onClick={() => setShowPhotoBorder((p) => !p)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        showPhotoBorder ? "bg-rose-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {showPhotoBorder ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB 2: STICKERS ── */}
          {leftTab === "stickers" && (
            <>
              <div>
                <label className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2 block">
                  Kategori Stiker
                </label>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {STICKER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setStickerCategory(cat.id)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        stickerCategory === cat.id
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Sticker Size Option */}
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <span>Ukuran Stiker:</span>
                  <div className="flex gap-1">
                    {[
                      { size: 36, label: "Kecil" },
                      { size: 48, label: "Sedang" },
                      { size: 68, label: "Besar" },
                    ].map((s) => (
                      <button
                        key={s.size}
                        onClick={() => setStickerSize(s.size)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          stickerSize === s.size
                            ? "bg-rose-600 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stickers Grid */}
                <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 rounded-2xl border border-gray-200 max-h-[28vh] overflow-y-auto">
                  {STICKER_CATEGORIES.find((c) => c.id === stickerCategory)?.emojis.map((emoji, idx) => (
                    <button
                      key={`${emoji}-${idx}`}
                      onClick={() => addSticker(emoji)}
                      className="text-2xl h-11 flex items-center justify-center bg-white hover:bg-rose-50 hover:scale-110 active:scale-90 rounded-xl transition-all shadow-xs border border-gray-100"
                      title="Klik untuk pasang di foto"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Upload Custom Sticker */}
                <label className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-300 rounded-xl text-xs font-semibold text-blue-700 cursor-pointer transition-colors">
                  <Upload size={13} /> Upload Gambar Custom
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleCustomStickerUpload}
                  />
                </label>
              </div>

              {/* Active Stickers List with controls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Stiker Terpasang ({stickers.length})
                  </label>
                  {stickers.length > 0 && (
                    <button
                      onClick={clearAllStickers}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mb-2">💡 Drag stiker di preview untuk memindahkan posisinya</p>

                {stickers.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Belum ada stiker. Tap stiker di atas untuk menempelkannya!
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[22vh] overflow-y-auto">
                    {stickers.map((s) => {
                      const isSelected = selectedStickerId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedStickerId(isSelected ? null : s.id)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-rose-50 border-rose-300"
                              : "bg-gray-100 border-transparent hover:bg-gray-200"
                          }`}
                        >
                          <GripVertical size={12} className="text-gray-400 flex-shrink-0" />
                          {s.imageUrl ? (
                            <img src={s.imageUrl} className="w-6 h-6 rounded object-cover flex-shrink-0" alt="" />
                          ) : (
                            <span className="text-base flex-shrink-0">{s.emoji}</span>
                          )}
                          <span className="text-gray-600 truncate flex-1 text-[10px]">
                            {s.imageUrl ? "Gambar custom" : s.emoji} • {Math.round(s.size ?? 48)}px
                          </span>
                          {/* Rotate & resize controls — only for selected */}
                          {isSelected && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStickerResize(s.id, -8); }}
                                className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-xs"
                                title="Perkecil"
                              >−</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStickerResize(s.id, 8); }}
                                className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-xs"
                                title="Perbesar"
                              >+</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStickerRotate(s.id, -15); }}
                                className="w-5 h-5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center"
                                title="Putar kiri"
                              ><RotateCcw size={10} /></button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStickerRotate(s.id, 15); }}
                                className="w-5 h-5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center"
                                title="Putar kanan"
                              ><RotateCw size={10} /></button>
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSticker(s.id); }}
                            className="text-gray-400 hover:text-red-500 flex-shrink-0"
                            title="Hapus stiker"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TAB 3: SLOT POSITION ADJUSTMENTS (Zoom & Pan) ── */}
          {leftTab === "adjust" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ZoomIn size={14} className="text-rose-600" /> Posisi Foto dalam Slot
                </h4>
                <button
                  onClick={() => {
                    setZoom(1.0);
                    setOffsetX(0);
                    setOffsetY(0);
                    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { zoom: 1.0, offsetX: 0, offsetY: 0 } });
                  }}
                  className="text-[11px] text-rose-600 font-bold hover:underline flex items-center gap-1"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Zoom Foto</span>
                  <span className="font-mono font-bold text-rose-600">{zoom.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    setZoom(z);
                    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { zoom: z } });
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Geser Kiri/Kanan (Pan X)</span>
                  <span className="font-mono font-bold text-rose-600">{offsetX}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="2"
                  value={offsetX}
                  onChange={(e) => {
                    const ox = Number(e.target.value);
                    setOffsetX(ox);
                    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { offsetX: ox } });
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Geser Atas/Bawah (Pan Y)</span>
                  <span className="font-mono font-bold text-rose-600">{offsetY}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="2"
                  value={offsetY}
                  onChange={(e) => {
                    const oy = Number(e.target.value);
                    setOffsetY(oy);
                    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { offsetY: oy } });
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <p className="text-[11px] text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                💡 <strong>Tip:</strong> Pengaturan zoom & geser akan diterapkan seragam ke seluruh slot foto photostrip.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: LIVE CANVAS PREVIEW ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-3 min-h-[500px]">
        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 max-w-xl w-full shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>
                <strong>Mode Pratinjau Bingkai:</strong> Menampilkan contoh foto. Pilih bingkai, stiker & font di sini, lalu ambil foto Anda sendiri di Kamera!
              </span>
            </div>
            <button
              onClick={() => navigate("/camera")}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold whitespace-nowrap shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Camera size={14} /> Ambil Foto
            </button>
          </div>
        )}

        <div
          className="relative flex items-center justify-center py-2 overflow-auto max-h-[78vh]"
          ref={previewContainerRef}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs rounded-2xl z-10 gap-2">
              <Loader2 className="animate-spin text-white" size={36} />
              <span className="text-xs font-bold text-white">Memperbarui desain...</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="max-w-full rounded-2xl shadow-2xl transition-all"
            style={{ maxHeight: "72vh", width: "auto" }}
          />

          {/* ── Sticker Drag Overlay — absolute over the canvas ── */}
          {stickers.length > 0 && (
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ pointerEvents: "none" }}
              onPointerMove={handleStickerPointerMove}
              onPointerUp={handleStickerPointerUp}
              onPointerLeave={handleStickerPointerUp}
            >
              {stickers.map((s) => {
                const isSelected = selectedStickerId === s.id;
                return (
                  <div
                    key={s.id}
                    style={{
                      position: "absolute",
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg)`,
                      fontSize: `${Math.round((s.size ?? 48) * 0.55)}px`,
                      lineHeight: 1,
                      cursor: "grab",
                      userSelect: "none",
                      pointerEvents: "auto",
                      zIndex: isSelected ? 20 : 10,
                      filter: isSelected ? "drop-shadow(0 0 6px rgba(244,63,94,0.8))" : undefined,
                      transition: dragStateRef.current?.id === s.id ? "none" : "filter 0.15s",
                    }}
                    onPointerDown={(e) => handleStickerPointerDown(e, s.id)}
                    title={`Drag untuk pindah • Klik untuk pilih`}
                  >
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        style={{
                          width: `${Math.round((s.size ?? 48) * 0.55)}px`,
                          height: `${Math.round((s.size ?? 48) * 0.55)}px`,
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span style={{ pointerEvents: "none" }}>{s.emoji}</span>
                    )}

                    {/* Quick delete button */}
                    {isSelected && (
                      <button
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#e11d48",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          pointerEvents: "auto",
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removeSticker(s.id); setSelectedStickerId(null); }}
                        title="Hapus stiker"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Click outside overlay to deselect sticker */}
          {selectedStickerId && (
            <div
              className="absolute inset-0 z-5"
              style={{ pointerEvents: "auto" }}
              onClick={() => setSelectedStickerId(null)}
            />
          )}
        </div>

        <button
          onClick={handleProceed}
          className="flex items-center gap-2 px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all"
        >
          Lanjut ke Hasil & Cetak <ArrowRight size={18} />
        </button>
      </div>

      {/* ── RIGHT PANEL: TYPOGRAPHY STUDIO & MIX FONTS ── */}
      <div className="w-full lg:w-80 bg-white border-l border-gray-200 p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-56px)] shadow-xs">
        <div className="border-b border-gray-200 pb-3">
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Type size={16} className="text-rose-600" /> Studio Tipografi (Mix Font)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Padukan font berbeda untuk judul, caption, dan tanggal!
          </p>
        </div>

        {/* ── Section 1: Header Title ── */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-gray-800">1. Judul Atas (Header)</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showHeader}
                onChange={(e) => setShowHeader(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {showHeader && (
            <>
              <input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Tulis judul photostrip..."
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-rose-600"
              />

              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Pilihan Font Judul:</label>
                <select
                  value={headerFont}
                  onChange={(e) => setHeaderFont(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-600 cursor-pointer"
                  style={{ fontFamily: headerFont }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.family} style={{ fontFamily: f.family }}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>Ukuran Judul</span>
                  <span className="font-mono font-bold text-rose-600">{headerSize}px</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="56"
                  step="2"
                  value={headerSize}
                  onChange={(e) => setHeaderSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Section 2: Caption / Pesan (Independent Font!) ── */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-gray-800">2. Pesan Bawah (Caption)</span>
          </div>

          <input
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              dispatch({ type: "SET_CAPTION", payload: e.target.value });
            }}
            placeholder="Tulis kata-kata / nama..."
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-rose-600"
          />

          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Pilihan Font Caption:</label>
            <select
              value={captionFont}
              onChange={(e) => setCaptionFont(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-600 cursor-pointer"
              style={{ fontFamily: captionFont }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.family} style={{ fontFamily: f.family }}>
                  {f.name} ({f.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>Ukuran Caption</span>
              <span className="font-mono font-bold text-rose-600">{captionSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="44"
              step="2"
              value={captionSize}
              onChange={(e) => setCaptionSize(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
            />
          </div>
        </div>

        {/* ── Section 3: Tanggal (Independent Font!) ── */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-gray-800">3. Tanggal / Stempel</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showDate}
                onChange={(e) => setShowDate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {showDate && (
            <>
              <input
                value={dateCustomText}
                onChange={(e) => setDateCustomText(e.target.value)}
                placeholder="Tanggal / Lokasi..."
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-rose-600"
              />

              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Pilihan Font Tanggal:</label>
                <select
                  value={dateFont}
                  onChange={(e) => setDateFont(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-600 cursor-pointer"
                  style={{ fontFamily: dateFont }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.family} style={{ fontFamily: f.family }}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>Ukuran Tanggal</span>
                  <span className="font-mono font-bold text-rose-600">{dateSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                  value={dateSize}
                  onChange={(e) => setDateSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Section 4: Text Color Palette ── */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <label className="font-bold text-xs text-gray-800 flex items-center gap-1.5 mb-2">
            <Palette size={14} className="text-rose-600" /> Warna Teks
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setTextColorChoice(c.value)}
                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-all truncate flex items-center justify-center gap-1 ${
                  textColorChoice === c.value
                    ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs ring-1 ring-rose-200"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {c.value !== "auto" && (
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: c.value }}
                  />
                )}
                <span className="truncate">{c.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
