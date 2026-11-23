import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import {
  Download, Printer, RefreshCw, Edit3, Image, Video,
  Film, QrCode, Smartphone, CheckCircle2, AlertCircle, Copy, Check
} from "lucide-react";
import QRCode from "qrcode";
import gifshot from "gifshot";
import { getApiUrl } from "../services/api";

const API_URL = getApiUrl();

type ResultTab = "photostrip" | "gif" | "video" | "qr";

export default function ResultPage() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ResultTab>("photostrip");
  const [gifUrl, setGifUrl] = useState<string | null>(state.sessionGifResult);
  const [gifGenerating, setGifGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [downloadPageUrl, setDownloadPageUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const result = state.photostripResult;
  const photos = state.filteredPhotos.length > 0 ? state.filteredPhotos : state.capturedPhotos;
  const sessionVideo = state.sessionVideoUrl;

  const lastGenPhotosRef = useRef<string>("");
  const lastSavedStripRef = useRef<string>("");

  // 0. Auto-save Photostrip to Gallery
  useEffect(() => {
    if (result && lastSavedStripRef.current !== result) {
      lastSavedStripRef.current = result;
      dispatch({
        type: "ADD_GALLERY_ITEM",
        payload: {
          id: `strip-${Date.now()}`,
          thumbnail: result,
          fullImage: result,
          createdAt: new Date().toISOString(),
          filters: state.activeFilters,
          itemType: "strip",
        },
      });
    }
  }, [result, dispatch, state.activeFilters]);

  // 1. Generate GIF Boomerang Animation (Bagian 14.1 PDF) - Always fresh per session
  const sessionKey = photos.map((p, i) => `${i}:${p.slice(0, 36)}`).join("|");
  useEffect(() => {
    if (photos.length > 0 && lastGenPhotosRef.current !== sessionKey) {
      lastGenPhotosRef.current = sessionKey;
      setGifGenerating(true);
      setGifUrl(null);

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
  }, [photos, sessionKey, dispatch]);

  // 2. Upload photostrip to cloud backend → generate QR Code pointing to smartphone download URL
  const uploadToCloud = useCallback(async () => {
    if (!result) return;
    setUploadStatus("uploading");
    setQrCodeDataUrl("");

    try {
      const body: { image: string; gif?: string } = { image: result };
      if (gifUrl) body.gif = gifUrl;

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000), // Render free tier cold-start may take up to 25s
      });

      if (!res.ok) throw new Error(`Upload failed: status ${res.status}`);
      const data = (await res.json()) as { key: string };
      const cleanPath = window.location.pathname.endsWith("/")
        ? window.location.pathname
        : `${window.location.pathname}/`;
      const dlUrl = `${window.location.origin}${cleanPath}#/download?key=${data.key}`;
      setDownloadPageUrl(dlUrl);

      const qr = await QRCode.toDataURL(dlUrl, {
        margin: 1,
        width: 256,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrCodeDataUrl(qr);
      setUploadStatus("ready");
    } catch (err) {
      console.error("Upload to backend failed:", err);
      setUploadStatus("error");
    }
  }, [result, gifUrl]);

  useEffect(() => {
    uploadToCloud();
  }, [uploadToCloud]);

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
      <div className="bg-white rounded-3xl shadow-md p-6 max-w-2xl w-full border border-gray-200 flex flex-col items-center">
        {activeTab === "photostrip" && (
          <>
            {result ? (
              <img
                src={`data:image/png;base64,${result}`}
                alt="Photostrip Final"
                className="w-full max-h-[70vh] object-contain rounded-xl shadow-xs"
                style={{ imageRendering: "auto" }}
              />
            ) : (
              <p className="text-gray-400 py-12 text-center text-sm">Photostrip belum dibuat.</p>
            )}
            <div className="mt-5 w-full flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadPNG}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 active:scale-95 transition-all shadow"
              >
                <Download size={18} /> Unduh PNG (300 DPI)
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && result && (
                <button
                  onClick={async () => {
                    try {
                      const blob = await (await fetch(`data:image/png;base64,${result}`)).blob();
                      const file = new File([blob], `pckv-photostrip-${Date.now()}.png`, { type: "image/png" });
                      if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ files: [file], title: "PCKV Photostrip" });
                      } else {
                        handleDownloadPNG();
                      }
                    } catch { handleDownloadPNG(); }
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-rose-300 text-rose-700 rounded-xl font-semibold text-sm hover:bg-rose-50 active:scale-95 transition-all shadow-xs"
                >
                  <Smartphone size={16} /> Bagikan ke HP
                </button>
              )}
            </div>
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
          <div className="flex flex-col items-center text-center py-2 max-w-sm w-full mx-auto">
            {uploadStatus === "uploading" && (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-gray-800">Menghubungkan ke Server Cloud...</p>
                <p className="text-xs text-gray-500">Mempersiapkan link unduh foto untuk smartphone Anda</p>
              </div>
            )}

            {uploadStatus === "error" && (
              <div className="py-8 flex flex-col items-center gap-3 w-full">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
                  <AlertCircle size={28} />
                </div>
                <p className="text-sm font-bold text-gray-800">Gagal Mengunggah ke Server Transfer</p>
                <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                  Server cloud sedang bersiap atau koneksi terputus. Silakan klik tombol di bawah untuk mencoba kembali.
                </p>
                <button
                  onClick={() => uploadToCloud()}
                  className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <RefreshCw size={14} /> Coba Unggah Lagi
                </button>
              </div>
            )}

            {uploadStatus === "ready" && (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold mb-3 shadow-2xs">
                  <CheckCircle2 size={14} /> QR Code Siap Discan
                </div>

                <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/20 shadow-md mb-3">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-52 h-52 rounded-lg" />
                  ) : (
                    <p className="text-xs text-gray-400">Membuat QR...</p>
                  )}
                </div>

                <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-1">
                  <Smartphone size={16} className="text-rose-600" /> Buka Kamera HP Anda
                </p>
                <p className="text-[11px] text-gray-500 max-w-xs mb-3">
                  Arahkan kamera HP ke QR Code di atas. Ketuk link yang muncul untuk membuka dan menyimpan foto ke galeri smartphone.
                </p>

                {downloadPageUrl && (
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 max-w-xs w-full text-left shadow-2xs">
                    <span className="text-[10px] text-gray-500 font-mono truncate flex-1">{downloadPageUrl}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(downloadPageUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check size={11} className="text-emerald-600" /> Tersalin!
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> Salin Link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
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
          onClick={() => navigate("/gallery")}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-xl text-xs font-semibold hover:border-gray-400 active:scale-95 transition-all shadow-xs"
        >
          <Image size={16} className="text-rose-600" /> Buka Galeri Sesi
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
