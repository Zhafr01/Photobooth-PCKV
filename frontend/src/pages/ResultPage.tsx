import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import {
  Download, Printer, RefreshCw, Edit3, Image, Video,
  Film, QrCode, Smartphone
} from "lucide-react";
import QRCode from "qrcode";
import gifshot from "gifshot";

type ResultTab = "photostrip" | "gif" | "video" | "qr";

export default function ResultPage() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ResultTab>("photostrip");
  const [gifUrl, setGifUrl] = useState<string | null>(state.sessionGifResult);
  const [gifGenerating, setGifGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const result = state.photostripResult;
  const photos = state.filteredPhotos.length > 0 ? state.filteredPhotos : state.capturedPhotos;
  const sessionVideo = state.sessionVideoUrl;

  // 1. Generate GIF Boomerang Animation (Bagian 14.1 PDF)
  useEffect(() => {
    if (!gifUrl && photos.length > 0) {
      setGifGenerating(true);

      // Normalize all photos to same size (480×360) before making GIF
      // This prevents gifshot from failing when photos have different aspect ratios
      const GIF_W = 480, GIF_H = 360;
      const normalizeImage = (b64: string): Promise<string> =>
        new Promise((resolve) => {
          const img = new window.Image();
          const src = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = GIF_W;
            c.height = GIF_H;
            const ctx = c.getContext("2d")!;
            const scale = Math.max(GIF_W / img.width, GIF_H / img.height);
            const sw = GIF_W / scale, sh = GIF_H / scale;
            const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, GIF_W, GIF_H);
            resolve(c.toDataURL("image/png"));
          };
          img.onerror = () => resolve(src);
          img.src = src;
        });

      Promise.all(photos.map(normalizeImage))
        .then((normalized) => {
          const seq =
            normalized.length === 1
              ? [normalized[0], normalized[0]]
              : [...normalized, ...[...normalized].reverse().slice(1, -1)];

          gifshot.createGIF(
            {
              images: seq,
              interval: 0.25,
              gifWidth: GIF_W,
              gifHeight: GIF_H,
              numWorkers: 2,
              sampleInterval: 10,
            } as any,
            (obj: { error: boolean; image: string; errorMsg?: string }) => {
              setGifGenerating(false);
              if (!obj.error && obj.image) {
                setGifUrl(obj.image);
                dispatch({ type: "SET_SESSION_GIF", payload: obj.image });
              } else {
                console.warn("GIF generation failed:", obj.errorMsg);
              }
            }
          );
        })
        .catch((e) => {
          console.warn("GIF normalization failed:", e);
          setGifGenerating(false);
        });
    }
  }, [photos, gifUrl, dispatch]);

  // 2. Upload photostrip to backend → generate QR Code pointing to download URL
  useEffect(() => {
    if (!result) return;

    const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

    const doUpload = async () => {
      try {
        const body: { image: string; gif?: string } = { image: result };
        if (gifUrl) body.gif = gifUrl;

        const res = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = (await res.json()) as { key: string };
        const cleanPath = window.location.pathname.endsWith("/")
          ? window.location.pathname
          : `${window.location.pathname}/`;
        const downloadPageUrl = `${window.location.origin}${cleanPath}#/download?key=${data.key}`;

        QRCode.toDataURL(downloadPageUrl, { margin: 1, width: 240 })
          .then((url) => setQrCodeDataUrl(url))
          .catch(console.error);
      } catch (err) {
        console.warn("Upload to backend failed, QR fallback ke halaman hasil:", err);
        const cleanPath = window.location.pathname.endsWith("/")
          ? window.location.pathname
          : `${window.location.pathname}/`;
        QRCode.toDataURL(`${window.location.origin}${cleanPath}#/result`, { margin: 1, width: 240 })
          .then((url) => setQrCodeDataUrl(url))
          .catch(console.error);
      }
    };

    doUpload();
  }, [result, gifUrl]);

  const handleDownloadPNG = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${result}`;
    link.download = `photobooth-strip-${Date.now()}.png`;
    link.click();
  };

  const handleDownloadGIF = () => {
    if (!gifUrl) return;
    const link = document.createElement("a");
    link.href = gifUrl;
    link.download = `photobooth-boomerang-${Date.now()}.gif`;
    link.click();
  };

  const handleDownloadVideo = () => {
    if (!sessionVideo) return;
    const link = document.createElement("a");
    link.href = sessionVideo;
    link.download = `photobooth-video-${Date.now()}.webm`;
    link.click();
  };

  const handlePrint = () => window.print();

  const handleNewSession = () => {
    dispatch({ type: "RESET" });
    navigate("/");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] flex flex-col items-center justify-start p-6 gap-5"
    >
      <div className="text-center">
        <h1 className="text-3xl font-black text-gray-900 font-serif mb-1">
          Photostrip Siap!
        </h1>
        <p className="text-gray-500 text-sm">Hasil sesi foto Anda siap diunduh, dicetak, atau disimpan ke smartphone</p>
      </div>

      {/* Tabs Output Media (Foto, GIF, Video, QR Code) */}
      <div className="flex flex-wrap gap-2 justify-center bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs">
        <button
          onClick={() => setActiveTab("photostrip")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "photostrip" ? "bg-rose-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Image size={15} /> Photostrip (PNG)
        </button>

        <button
          onClick={() => setActiveTab("gif")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "gif" ? "bg-rose-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Film size={15} /> GIF Boomerang
        </button>

        {sessionVideo && (
          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "video" ? "bg-rose-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Video size={15} /> Video Sesi
          </button>
        )}

        <button
          onClick={() => setActiveTab("qr")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "qr" ? "bg-rose-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <QrCode size={15} /> Scan ke HP (QR)
        </button>
      </div>

      {/* Main Preview Display Card */}
      <div className="bg-white rounded-3xl shadow-md p-6 max-w-md w-full border border-gray-200 flex flex-col items-center">
        {activeTab === "photostrip" && (
          <>
            {result ? (
              <img
                src={`data:image/png;base64,${result}`}
                alt="Photostrip Final"
                className="w-full max-h-[60vh] object-contain rounded-xl shadow-xs"
              />
            ) : (
              <p className="text-gray-400 py-12 text-center text-sm">Photostrip belum dibuat.</p>
            )}
            <button
              onClick={handleDownloadPNG}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 active:scale-95 transition-all shadow"
            >
              <Download size={18} /> Unduh Photostrip PNG (300 DPI)
            </button>
          </>
        )}

        {activeTab === "gif" && (
          <>
            {gifGenerating ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-500">
                <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-medium">Merangkai GIF Boomerang dari kumpulan pose...</p>
              </div>
            ) : gifUrl ? (
              <img src={gifUrl} alt="GIF Boomerang" className="w-full rounded-xl shadow-xs" />
            ) : (
              <p className="text-gray-400 py-12 text-center text-sm">Tidak dapat membuat GIF.</p>
            )}
            <button
              onClick={handleDownloadGIF}
              disabled={!gifUrl}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 active:scale-95 transition-all shadow disabled:opacity-40"
            >
              <Download size={18} /> Unduh Animasi GIF
            </button>
          </>
        )}

        {activeTab === "video" && sessionVideo && (
          <>
            <video
              src={sessionVideo}
              controls
              autoPlay
              loop
              className="w-full rounded-xl bg-black shadow-xs max-h-[50vh]"
            />
            <button
              onClick={handleDownloadVideo}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 active:scale-95 transition-all shadow"
            >
              <Download size={18} /> Unduh Video Sesi (WebM)
            </button>
          </>
        )}

        {activeTab === "qr" && (
          <div className="flex flex-col items-center text-center py-2">
            <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-xs mb-3">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48" />
              ) : (
                <p className="text-xs text-gray-400">Membuat QR...</p>
              )}
            </div>
            <p className="text-xs font-bold text-gray-800 flex items-center gap-1 mb-1">
              <Smartphone size={15} className="text-rose-600" /> Buka Kamera HP Anda
            </p>
            <p className="text-[11px] text-gray-500 max-w-xs mb-4">
              Arahkan kamera HP ke QR Code di atas untuk membuka galeri hasil photostrip dan mengunduh langsung ke galeri smartphone.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer Buttons (Cetak, Edit Ulang, Sesi Baru) */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-xl text-xs font-semibold hover:border-gray-400 active:scale-95 transition-all"
        >
          <Printer size={16} /> Cetak Langsung (Print)
        </button>

        <button
          onClick={() => navigate("/photostrip")}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-600 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 active:scale-95 transition-all"
        >
          <Edit3 size={16} /> Edit Posisi & Frame
        </button>

        <button
          onClick={handleNewSession}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-300 active:scale-95 transition-all"
        >
          <RefreshCw size={16} /> Sesi Baru
        </button>
      </div>

      {/* Print Styles for 2x6 and 4x6 Photo Paper */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          nav, button, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
