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
      const imgSources = photos.map((p) => `data:image/png;base64,${p}`);
      // Boomerang effect: add reverse sequence
      const boomerangSequence = [...imgSources, ...[...imgSources].reverse().slice(1, -1)];

      gifshot.createGIF(
        {
          images: boomerangSequence,
          interval: 0.3,
          gifWidth: 480,
          gifHeight: 360,
        },
        (obj: { error: boolean; image: string }) => {
          setGifGenerating(false);
          if (!obj.error && obj.image) {
            setGifUrl(obj.image);
            dispatch({ type: "SET_SESSION_GIF", payload: obj.image });
          }
        }
      );
    }
  }, [photos, gifUrl, dispatch]);

  // 2. Generate QR Code for Phone Download (Bagian 16 PDF)
  useEffect(() => {
    const downloadUrl = window.location.href;
    QRCode.toDataURL(downloadUrl, { margin: 1, width: 240 })
      .then((url) => setQrCodeDataUrl(url))
      .catch(console.error);
  }, []);

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
