import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import type { Sticker, PhotostripLayout } from "../types";
import { ArrowRight, Trash2, Loader2, ZoomIn, Frame } from "lucide-react";

const FRAME_COLORS = [
  { label: "Putih Studio", value: "#FFFFFF" },
  { label: "Hitam Klasik", value: "#1A1A1A" },
  { label: "Warm Ivory", value: "#FAF7F2" },
  { label: "Crimson Rose", value: "#E11D48" },
  { label: "Soft Pink", value: "#FCE7F3" },
  { label: "Slate Blue", value: "#334155" },
];

const STICKER_OPTIONS = ["🌸", "⭐", "💖", "🌙", "🎀", "🌺", "💝", "🍓", "🦋", "🌈"];

export default function PhotostripEditor() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [frameColor, setFrameColor] = useState(state.photostripFrame.color || "#FFFFFF");
  const [caption, setCaption] = useState(state.captionText || "");
  const [showDate, setShowDate] = useState(true);
  const [stickers, setStickers] = useState<Sticker[]>(state.photostripStickers || []);

  // Photo Crop/Pan/Zoom Adjustments (Bagian 13.3 PDF)
  const [zoom, setZoom] = useState(state.photoZoom || 1.0);
  const [offsetX, setOffsetX] = useState(state.photoOffsetX || 0);
  const [offsetY, setOffsetY] = useState(state.photoOffsetY || 0);

  const photos = state.filteredPhotos.length > 0 ? state.filteredPhotos : state.capturedPhotos;
  const layout = state.photostripLayout;

  const addSticker = (emoji: string) => {
    const newSticker: Sticker = {
      id: `${Date.now()}`,
      emoji,
      x: Math.random() * 60 + 20,
      y: Math.random() * 60 + 20,
      size: 32,
    };
    setStickers((prev) => [...prev, newSticker]);
    dispatch({ type: "SET_STICKERS", payload: [...stickers, newSticker] });
  };

  const removeSticker = (id: string) => {
    const updated = stickers.filter((s) => s.id !== id);
    setStickers(updated);
    dispatch({ type: "SET_STICKERS", payload: updated });
  };

  const handleZoomChange = (val: number) => {
    setZoom(val);
    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { zoom: val } });
  };

  const handleOffsetXChange = (val: number) => {
    setOffsetX(val);
    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { offsetX: val } });
  };

  const handleOffsetYChange = (val: number) => {
    setOffsetY(val);
    dispatch({ type: "SET_PHOTO_ADJUSTMENT", payload: { offsetY: val } });
  };

  /* ── 300 DPI Standard Photostrip Canvas Drawing ── */
  const drawPhotostrip = async () => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;
    setLoading(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let canvasWidth = 600;
    let canvasHeight = 1800;
    let count = 4;
    let photoW = 520;
    let photoH = 360;
    const pad = 40;
    const headerH = 110;
    const footerH = caption || showDate ? 120 : 60;

    if (layout === "strip3") {
      canvasWidth = 600;
      canvasHeight = 1800;
      count = 3;
      photoW = 520;
      photoH = 480;
    } else if (layout === "grid2x2") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 4;
      photoW = 530;
      photoH = 700;
    } else if (layout === "singleCard") {
      canvasWidth = 1200;
      canvasHeight = 1800;
      count = 1;
      photoW = 1100;
      photoH = 1450;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Draw Frame Background
    ctx.fillStyle = frameColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Header
    const isDarkFrame = frameColor === "#1A1A1A" || frameColor === "#334155";
    ctx.fillStyle = isDarkFrame ? "#FFFFFF" : "#1A1A1A";
    ctx.font = "bold 34px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("PHOTOBOOTH", canvas.width / 2, 70);

    // 3. Load & Draw Photos with Crop/Pan/Zoom
    const loadImg = (b64: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = `data:image/png;base64,${b64}`;
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
        x = pad + 10;
        y = headerH + 20;
      }

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, photoW, photoH, 12);
      ctx.clip();

      // Calculate Source Rect with Zoom & Pan Offset
      const sWidth = img.width / zoom;
      const sHeight = img.height / zoom;
      const sX = Math.max(0, Math.min(img.width - sWidth, (img.width - sWidth) / 2 + (offsetX / 100) * (img.width - sWidth)));
      const sY = Math.max(0, Math.min(img.height - sHeight, (img.height - sHeight) / 2 + (offsetY / 100) * (img.height - sHeight)));

      ctx.drawImage(img, sX, sY, sWidth, sHeight, x, y, photoW, photoH);
      ctx.restore();
    });

    // 4. Draw Stickers
    ctx.font = "44px serif";
    ctx.textAlign = "left";
    stickers.forEach((s) => {
      const sx = (s.x / 100) * canvas.width;
      const sy = (s.y / 100) * canvas.height;
      ctx.fillText(s.emoji, sx, sy);
    });

    // 5. Draw Footer (Caption & Date)
    if (caption || showDate) {
      const fy = canvas.height - footerH + 45;
      ctx.fillStyle = isDarkFrame ? "#D1D5DB" : "#4B5563";
      ctx.font = "bold 22px 'Inter', sans-serif";
      ctx.textAlign = "center";
      if (caption) ctx.fillText(caption, canvas.width / 2, fy);
      if (showDate) {
        const dateStr = new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        ctx.font = "18px 'Inter', sans-serif";
        ctx.fillText(dateStr, canvas.width / 2, fy + (caption ? 34 : 0));
      }
    }

    dispatch({
      type: "SET_PHOTOSTRIP_RESULT",
      payload: canvas.toDataURL("image/png").split(",")[1],
    });
    setLoading(false);
  };

  useEffect(() => {
    if (photos.length > 0) {
      drawPhotostrip();
    }
  }, [photos, layout, frameColor, stickers, caption, showDate, zoom, offsetX, offsetY]);

  const handleProceed = () => {
    navigate("/result");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] flex flex-col md:flex-row"
    >
      {/* Left Panel: Template, Layout, Frame Colors */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-56px)]">
        <div>
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Frame size={14} className="text-rose-600" /> Template Photostrip
          </h3>
          <div className="flex flex-col gap-1.5">
            {[
              { key: "strip4", label: "Strip 4 Foto (2×6\")" },
              { key: "strip3", label: "Strip 3 Foto (2×6\")" },
              { key: "grid2x2", label: "Grid 2×2 (4×6\")" },
              { key: "singleCard", label: "Kartu 1 Foto (4×6\")" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => dispatch({ type: "SET_LAYOUT", payload: t.key as PhotostripLayout })}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all ${
                  layout === t.key
                    ? "border-rose-600 bg-rose-50 text-rose-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2">
            Warna Bingkai
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {FRAME_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setFrameColor(c.value)}
                className={`h-9 rounded-xl border-2 transition-all ${
                  frameColor === c.value ? "border-rose-600 ring-2 ring-rose-200 scale-105" : "border-gray-300"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        {/* Photo Slot Adjuster: Zoom & Pan */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ZoomIn size={14} className="text-rose-600" /> Atur Posisi Foto di Slot
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Zoom Foto</span>
                <span className="font-mono font-bold text-rose-600">{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Geser Horisontal (Pan X)</span>
                <span className="font-mono font-bold text-rose-600">{offsetX}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="2"
                value={offsetX}
                onChange={(e) => handleOffsetXChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Geser Vertikal (Pan Y)</span>
                <span className="font-mono font-bold text-rose-600">{offsetY}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="2"
                value={offsetY}
                onChange={(e) => handleOffsetYChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2">
            Stiker Dekorasi
          </h3>
          <div className="grid grid-cols-5 gap-1.5">
            {STICKER_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => addSticker(e)}
                className="text-xl p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
          {stickers.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              {stickers.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  <span>Stiker {s.emoji}</span>
                  <button onClick={() => removeSticker(s.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Canvas Preview */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <div className="relative bg-white rounded-2xl shadow-md p-4 overflow-auto max-h-[75vh] border border-gray-200">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl z-10">
              <Loader2 className="animate-spin text-rose-600" size={40} />
            </div>
          )}
          <canvas ref={canvasRef} className="max-w-full" style={{ maxHeight: "68vh", width: "auto" }} />
        </div>
        <button
          onClick={handleProceed}
          className="flex items-center gap-2 px-8 py-3.5 bg-rose-600 text-white rounded-2xl font-semibold shadow hover:bg-rose-700 active:scale-95 transition-all"
        >
          Lanjut ke Hasil & Cetak <ArrowRight size={18} />
        </button>
      </div>

      {/* Right Panel: Caption & Text */}
      <div className="w-full md:w-60 bg-white border-l border-gray-200 p-4 flex flex-col gap-4">
        <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
          Teks Caption & Tanggal
        </h3>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Caption Photostrip</label>
          <input
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              dispatch({ type: "SET_CAPTION", payload: e.target.value });
            }}
            placeholder="Tulis ucapan/nama..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-600"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => setShowDate(e.target.checked)}
            className="accent-rose-600 w-4 h-4 rounded"
          />
          Cetak tanggal hari ini
        </label>
        <div className="mt-auto text-xs text-gray-400 text-center pt-4 border-t border-gray-100">
          Standar cetak foto: 300 DPI siap cetak
        </div>
      </div>
    </motion.div>
  );
}
