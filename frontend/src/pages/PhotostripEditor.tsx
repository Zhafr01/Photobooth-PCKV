import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import type { Sticker, PhotostripLayout } from "../types";
import {
  ArrowRight, Loader2, ZoomIn, Frame, Sparkles,
  Type, Palette, Move, RotateCcw, X
} from "lucide-react";

/* ── 1. FRAME THEMES DATA (24+ Themes Across 5 Categories) ── */
export interface FrameTheme {
  id: string;
  name: string;
  category: "klasik" | "pastel" | "gradient" | "vintage" | "pattern";
  type: "solid" | "gradient" | "pattern" | "film";
  color: string;
  gradient?: [string, string];
  pattern?: "polka" | "checker" | "grid" | "hearts";
  textColor?: string;
  borderColor?: string;
  hasDoubleBorder?: boolean;
}

const FRAME_THEMES: FrameTheme[] = [
  // ── Klasik & Studio ──
  { id: "white", name: "Putih Studio", category: "klasik", type: "solid", color: "#FFFFFF", textColor: "#1A1A1A" },
  { id: "black", name: "Hitam Editorial", category: "klasik", type: "solid", color: "#18181B", textColor: "#FFFFFF" },
  { id: "ivory", name: "Warm Ivory", category: "klasik", type: "solid", color: "#FAF7F2", textColor: "#292524" },
  { id: "slate", name: "Slate Minimalist", category: "klasik", type: "solid", color: "#334155", textColor: "#F8FAFC" },
  { id: "espresso", name: "Espresso Dark", category: "klasik", type: "solid", color: "#271E18", textColor: "#F5EBE0" },

  // ── Pastel & Aesthetic ──
  { id: "sakura", name: "Sakura Pink", category: "pastel", type: "solid", color: "#FCE7F3", textColor: "#831843", borderColor: "#F472B6" },
  { id: "lavender", name: "Lavender Dream", category: "pastel", type: "solid", color: "#EDE9FE", textColor: "#4C1D95", borderColor: "#C4B5FD" },
  { id: "matcha", name: "Matcha Mint", category: "pastel", type: "solid", color: "#DCFCE7", textColor: "#14532D", borderColor: "#86EFAC" },
  { id: "butter", name: "Butter Yellow", category: "pastel", type: "solid", color: "#FEF9C3", textColor: "#713F12", borderColor: "#FDE047" },
  { id: "sky", name: "Baby Sky Blue", category: "pastel", type: "solid", color: "#E0F2FE", textColor: "#0C4A6E", borderColor: "#7DD3FC" },
  { id: "peach", name: "Soft Peach", category: "pastel", type: "solid", color: "#FFEDD5", textColor: "#7C2D12", borderColor: "#FDBA74" },

  // ── Gradient Aesthetic ──
  { id: "sunset", name: "Sunset Horizon", category: "gradient", type: "gradient", color: "#FF5E62", gradient: ["#FF5E62", "#FF9966"], textColor: "#FFFFFF" },
  { id: "neon", name: "Neon Cyberpunk", category: "gradient", type: "gradient", color: "#8A2387", gradient: ["#8A2387", "#E94057"], textColor: "#FFFFFF" },
  { id: "cotton", name: "Cotton Candy", category: "gradient", type: "gradient", color: "#F472B6", gradient: ["#F472B6", "#A78BFA"], textColor: "#FFFFFF" },
  { id: "ocean", name: "Ocean Breeze", category: "gradient", type: "gradient", color: "#00b4db", gradient: ["#00b4db", "#0083b0"], textColor: "#FFFFFF" },
  { id: "midnight", name: "Midnight Aurora", category: "gradient", type: "gradient", color: "#0f172a", gradient: ["#0f172a", "#1e293b"], textColor: "#E2E8F0" },
  { id: "emerald", name: "Emerald Forest", category: "gradient", type: "gradient", color: "#064e3b", gradient: ["#064e3b", "#059669"], textColor: "#ECFDF5" },

  // ── Retro & Vintage ──
  { id: "polaroid", name: "90s Polaroid", category: "vintage", type: "solid", color: "#F7F3E9", textColor: "#3D3935", hasDoubleBorder: true },
  { id: "filmstrip", name: "35mm Film Strip", category: "vintage", type: "film", color: "#141414", textColor: "#FAFAFA" },
  { id: "parchment", name: "Vintage Parchment", category: "vintage", type: "solid", color: "#EFE0CD", textColor: "#452A0A", borderColor: "#D5BE9E" },
  { id: "terracotta", name: "70s Terracotta", category: "vintage", type: "solid", color: "#C85A32", textColor: "#FFF7ED" },

  // ── Pattern & Fun ──
  { id: "polka", name: "Polka Dots Cute", category: "pattern", type: "pattern", pattern: "polka", color: "#FDF2F8", borderColor: "#F472B6", textColor: "#831843" },
  { id: "checker", name: "Y2K Checkerboard", category: "pattern", type: "pattern", pattern: "checker", color: "#18181B", borderColor: "#3F3F46", textColor: "#FFFFFF" },
  { id: "grid", name: "Notebook Grid", category: "pattern", type: "pattern", pattern: "grid", color: "#F8FAFC", borderColor: "#CBD5E1", textColor: "#0F172A" },
  { id: "hearts", name: "Sweet Hearts", category: "pattern", type: "pattern", pattern: "hearts", color: "#FFF1F2", borderColor: "#FB7185", textColor: "#9F1239" },
];

/* ── 2. STICKER CATEGORIES (100+ Emojis / Decorative Stickers) ── */
const STICKER_CATEGORIES = [
  {
    id: "cute",
    name: "Cute & Kawaii",
    icon: "🎀",
    emojis: ["🎀", "🧸", "🐰", "🐱", "🌸", "🍓", "🍰", "🍭", "🍡", "🧁", "🌷", "🩰", "🪞", "🐾", "🍼", "🍮", "🐣", "🧋", "🍒", "🍯"],
  },
  {
    id: "y2k",
    name: "Y2K & Aesthetic",
    icon: "✨",
    emojis: ["⭐", "✨", "💫", "🦋", "💖", "💿", "🍒", "💅", "⚡", "🪐", "🔮", "🫧", "🪩", "🕶️", "🎧", "🔥", "🖤", "🗝️", "🧿", "💎"],
  },
  {
    id: "love",
    name: "Love & Romance",
    icon: "💌",
    emojis: ["💌", "💘", "💝", "💕", "🌹", "💍", "💋", "🕊️", "💐", "🥂", "🕯️", "❤️‍🔥", "🫶", "🫰", "🤍", "😘", "🫀", "🏹", "💞", "🥰"],
  },
  {
    id: "party",
    name: "Party & Hype",
    icon: "🎉",
    emojis: ["🎉", "🥳", "🎂", "🎈", "🎊", "🍾", "👑", "🎁", "🎇", "🎆", "🎵", "🕺", "💃", "🍻", "🏆", "🪅", "🍿", "🎤", "🎷", "🎸"],
  },
  {
    id: "retro",
    name: "Retro & Fun",
    icon: "👾",
    emojis: ["👾", "🕹️", "📼", "🛹", "🍕", "🍟", "🥤", "🥑", "🌈", "🌻", "✌️", "🤪", "😎", "👀", "🤡", "🚀", "🍄", "🍦", "🍩", "📷"],
  },
  {
    id: "doodle",
    name: "Doodles & Chat",
    icon: "💬",
    emojis: ["💬", "🗯️", "💭", "💯", "✔️", "❌", "❓", "❗️", "⚡️", "💢", "💤", "🎶", "📸", "🎬", "🌟", "🏷️", "📌", "✂️", "🪄", "💡"],
  },
];

/* ── 3. FONT CATALOG (14+ Google & System Fonts) ── */
export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: "Script" | "Serif" | "Sans" | "Retro" | "Display";
}

const FONT_OPTIONS: FontOption[] = [
  // Script / Handwriting
  { id: "dancing", name: "Dancing Script", family: "'Dancing Script', cursive", category: "Script" },
  { id: "pacifico", name: "Pacifico", family: "'Pacifico', cursive", category: "Script" },
  { id: "caveat", name: "Caveat Doodle", family: "'Caveat', cursive", category: "Script" },

  // Serif
  { id: "playfair", name: "Playfair Display", family: "'Playfair Display', Georgia, serif", category: "Serif" },
  { id: "cinzel", name: "Cinzel Royal", family: "'Cinzel', Georgia, serif", category: "Serif" },
  { id: "georgia", name: "Georgia Klasik", family: "Georgia, serif", category: "Serif" },

  // Modern Sans
  { id: "montserrat", name: "Montserrat", family: "'Montserrat', sans-serif", category: "Sans" },
  { id: "inter", name: "Inter Sans", family: "'Inter', sans-serif", category: "Sans" },

  // Retro & Vintage
  { id: "abril", name: "Abril Fatface", family: "'Abril Fatface', serif", category: "Retro" },
  { id: "special_elite", name: "Special Elite (Mesin Tik)", family: "'Special Elite', monospace", category: "Retro" },
  { id: "righteous", name: "Righteous 80s", family: "'Righteous', cursive", category: "Retro" },
  { id: "courier", name: "Courier Monospace", family: "'Courier New', monospace", category: "Retro" },

  // Display & Y2K
  { id: "press_start", name: "Press Start (8-Bit Pixel)", family: "'Press Start 2P', monospace", category: "Display" },
  { id: "orbitron", name: "Orbitron Cyber Y2K", family: "'Orbitron', sans-serif", category: "Display" },
  { id: "impact", name: "Impact Bold", family: "Impact, sans-serif", category: "Display" },
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
    const found = FRAME_THEMES.find((f) => f.color.toLowerCase() === state.photostripFrame.color.toLowerCase());
    return found || FRAME_THEMES[0];
  });
  const [frameCategory, setFrameCategory] = useState<string>("all");

  // Sticker State
  const [stickerCategory, setStickerCategory] = useState<string>("cute");
  const [stickerSize, setStickerSize] = useState<number>(48);
  const [stickers, setStickers] = useState<Sticker[]>(state.photostripStickers || []);

  // Multi-Font & Text Customization (Mix Fonts)
  const [showHeader, setShowHeader] = useState(true);
  const [headerText, setHeaderText] = useState("PHOTOBOOTH");
  const [headerFont, setHeaderFont] = useState(FONT_OPTIONS[3].family); // Playfair
  const [headerSize, setHeaderSize] = useState(34);

  const [caption, setCaption] = useState(state.captionText || "");
  const [captionFont, setCaptionFont] = useState(FONT_OPTIONS[0].family); // Dancing Script
  const [captionSize, setCaptionSize] = useState(24);

  const [showDate, setShowDate] = useState(true);
  const [dateFont, setDateFont] = useState(FONT_OPTIONS[9].family); // Special Elite (Typewriter)
  const [dateSize, setDateSize] = useState(16);
  const [dateCustomText, setDateCustomText] = useState(() =>
    new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  );

  const [textColorChoice, setTextColorChoice] = useState<string>("auto");

  // Photo Crop/Pan/Zoom Adjustments
  const [zoom, setZoom] = useState(state.photoZoom || 1.0);
  const [offsetX, setOffsetX] = useState(state.photoOffsetX || 0);
  const [offsetY, setOffsetY] = useState(state.photoOffsetY || 0);

  const photos = state.filteredPhotos.length > 0 ? state.filteredPhotos : state.capturedPhotos;
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
    let photoW = 520;
    let photoH = 360;
    let pad = selectedTheme.type === "film" ? 52 : 40;
    const headerH = showHeader ? 110 : 40;
    const footerH = caption || showDate ? 140 : 50;

    if (layout === "strip3") {
      canvasWidth = 600;
      canvasHeight = 1800;
      count = 3;
      photoW = canvasWidth - pad * 2;
      photoH = 480;
    } else if (layout === "grid2x2") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 4;
      pad = selectedTheme.type === "film" ? 64 : 50;
      photoW = 520;
      photoH = 700;
    } else if (layout === "singleCard") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 1;
      pad = selectedTheme.type === "film" ? 64 : 50;
      photoW = canvasWidth - pad * 2;
      photoH = 1450;
    } else {
      // strip4
      photoW = canvasWidth - pad * 2;
      photoH = 360;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // ── 1. Draw Frame Background ──
    if (selectedTheme.type === "film") {
      // Authentic 35mm film strip with sprocket holes
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const holeW = 16, holeH = 26, holeR = 6;
      const holeStep = 55;
      ctx.fillStyle = "#F8FAFC";
      for (let hy = 20; hy < canvas.height - 20; hy += holeStep) {
        ctx.beginPath();
        ctx.roundRect(10, hy, holeW, holeH, holeR);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(canvas.width - 26, hy, holeW, holeH, holeR);
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
        ctx.fillStyle = selectedTheme.borderColor || "rgba(244, 114, 182, 0.4)";
        const step = 48;
        for (let py = 20; py < canvas.height; py += step) {
          for (let px = 20; px < canvas.width; px += step) {
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (selectedTheme.pattern === "checker") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        const sq = 36;
        for (let py = 0; py < canvas.height; py += sq) {
          for (let px = 0; px < canvas.width; px += sq) {
            if ((Math.floor(px / sq) + Math.floor(py / sq)) % 2 === 0) {
              ctx.fillRect(px, py, sq, sq);
            }
          }
        }
      } else if (selectedTheme.pattern === "grid") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 1.5;
        const gStep = 40;
        ctx.beginPath();
        for (let px = gStep; px < canvas.width; px += gStep) {
          ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
        }
        for (let py = gStep; py < canvas.height; py += gStep) {
          ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
        }
        ctx.stroke();
      } else if (selectedTheme.pattern === "hearts") {
        ctx.fillStyle = "rgba(251, 113, 133, 0.25)";
        ctx.font = "22px serif";
        ctx.textAlign = "center";
        for (let py = 35; py < canvas.height; py += 75) {
          for (let px = 35; px < canvas.width; px += 75) {
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
        ctx.lineWidth = 3;
        ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
        ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
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

    // ── 2. Draw Header (Custom Font) ──
    if (showHeader && headerText) {
      ctx.fillStyle = resolvedTextColor;
      ctx.font = `bold ${headerSize}px ${headerFont}`;
      ctx.textAlign = "center";
      ctx.fillText(headerText, canvas.width / 2, 70);
    }

    // ── 3. Load & Draw Photos with Aspect-Fill (Cover Crop) & Adjustments ──
    const loadImg = (b64: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        const src = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    const usedPhotos = photos.slice(0, count);
    const imgEls = await Promise.all(usedPhotos.map(loadImg));

    imgEls.forEach((img, i) => {
      let x = pad;
      let y = headerH + i * (photoH + 24);

      if (layout === "grid2x2") {
        const col = i % 2;
        const row = Math.floor(i / 2);
        x = pad + col * (photoW + 40);
        y = headerH + row * (photoH + 40);
      } else if (layout === "singleCard") {
        x = pad;
        y = headerH + 20;
      }

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, photoW, photoH, 12);
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
      const sX = Math.max(0, Math.min(maxOffsetX, (img.width - sWidth) / 2 + (offsetX / 100) * (maxOffsetX / 2)));
      const sY = Math.max(0, Math.min(maxOffsetY, (img.height - sHeight) / 2 + (offsetY / 100) * (maxOffsetY / 2)));

      ctx.drawImage(img, sX, sY, sWidth, sHeight, x, y, photoW, photoH);
      ctx.restore();
    });

    // ── 4. Draw Themed Stickers ──
    stickers.forEach((s) => {
      ctx.font = `${s.size || 48}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sx = (s.x / 100) * canvas.width;
      const sy = (s.y / 100) * canvas.height;
      ctx.fillText(s.emoji, sx, sy);
    });

    // ── 5. Draw Footer: Caption & Date (Separate Mixed Fonts!) ──
    if (caption || showDate) {
      const fy = canvas.height - footerH + 45;

      if (caption) {
        ctx.fillStyle = resolvedTextColor;
        ctx.font = `bold ${captionSize}px ${captionFont}`;
        ctx.textAlign = "center";
        ctx.fillText(caption, canvas.width / 2, fy);
      }

      if (showDate) {
        ctx.fillStyle = resolvedTextColor;
        ctx.font = `${dateSize}px ${dateFont}`;
        ctx.textAlign = "center";
        const dateY = fy + (caption ? captionSize + 14 : 10);
        ctx.fillText(dateCustomText, canvas.width / 2, dateY);
      }
    }

    dispatch({
      type: "SET_PHOTOSTRIP_RESULT",
      payload: canvas.toDataURL("image/png").split(",")[1],
    });
    setLoading(false);
  }, [
    photos, layout, selectedTheme, stickers, caption, captionFont, captionSize,
    showHeader, headerText, headerFont, headerSize, showDate, dateFont, dateSize,
    dateCustomText, textColorChoice, zoom, offsetX, offsetY, dispatch
  ]);

  useEffect(() => {
    if (photos.length > 0) {
      drawPhotostrip();
    }
  }, [drawPhotostrip, photos.length]);

  const handleProceed = () => {
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
                    { key: "strip4", label: "Strip 4 Foto" },
                    { key: "strip3", label: "Strip 3 Foto" },
                    { key: "grid2x2", label: "Grid 2×2" },
                    { key: "singleCard", label: "Kartu 1 Foto" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => dispatch({ type: "SET_LAYOUT", payload: t.key as PhotostripLayout })}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                        layout === t.key
                          ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {t.label}
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
                          ? "bg-rose-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Frame Themes Grid */}
                <div className="grid grid-cols-2 gap-2 max-h-[38vh] overflow-y-auto pr-1">
                  {filteredThemes.map((theme) => {
                    const isSelected = selectedTheme.id === theme.id;
                    const bgStyle =
                      theme.type === "gradient" && theme.gradient
                        ? { background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})` }
                        : { backgroundColor: theme.color };

                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedTheme(theme);
                          dispatch({ type: "SET_FRAME", payload: { color: theme.color } });
                        }}
                        className={`p-2.5 rounded-2xl border-2 text-left flex flex-col gap-2 transition-all relative overflow-hidden ${
                          isSelected
                            ? "border-rose-600 ring-2 ring-rose-300 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div
                          className="w-full h-8 rounded-lg shadow-inner border border-black/10 flex items-center justify-center"
                          style={bgStyle}
                        >
                          {theme.type === "film" && (
                            <span className="text-[9px] font-mono font-bold text-white tracking-widest">
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
                          {isSelected && <span className="w-2 h-2 rounded-full bg-rose-600" />}
                        </div>
                      </button>
                    );
                  })}
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
                <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 rounded-2xl border border-gray-200 max-h-[30vh] overflow-y-auto">
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
              </div>

              {/* Active Stickers List */}
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

                {stickers.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Belum ada stiker. Tap stiker di atas untuk menempelkannya!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-[20vh] overflow-y-auto">
                    {stickers.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-xl text-xs"
                      >
                        <span className="text-base">{s.emoji}</span>
                        <button
                          onClick={() => removeSticker(s.id)}
                          className="text-gray-400 hover:text-red-500"
                          title="Hapus stiker"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
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
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-4 min-h-[500px]">
        <div className="relative bg-white rounded-3xl shadow-xl p-4 sm:p-5 overflow-auto max-h-[75vh] border border-gray-200 flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-3xl z-10 gap-2">
              <Loader2 className="animate-spin text-rose-600" size={36} />
              <span className="text-xs font-bold text-gray-600">Memperbarui desain...</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="max-w-full rounded-xl shadow-md"
            style={{ maxHeight: "68vh", width: "auto" }}
          />
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
                  min="20"
                  max="46"
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
              min="14"
              max="34"
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
                  min="12"
                  max="24"
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
