/**
 * DownloadPage — halaman yang dibuka HP saat scan QR Code
 * Menampilkan preview foto & tombol unduh langsung ke galeri HP
 */
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, CheckCircle, AlertCircle, Loader, Share2 } from "lucide-react";
import { getApiUrl } from "../services/api";

const API_URL = getApiUrl();

export default function DownloadPage() {
  const [params] = useSearchParams();
  const key = params.get("key");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMessage, setLoadingMessage] = useState("Menghubungi server photobooth...");
  const [hasGif, setHasGif] = useState(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!key) {
      setStatus("error");
      return;
    }

    let isMounted = true;

    const checkStatus = () => {
      fetch(`${API_URL}/api/download/${key}/info`)
        .then((r) => {
          if (!r.ok) throw new Error(`Status ${r.status}`);
          return r.json() as Promise<{ has_png: boolean; has_gif: boolean }>;
        })
        .then((info) => {
          if (!isMounted) return;
          setHasGif(info.has_gif);
          setStatus("ready");
        })
        .catch(() => {
          if (!isMounted) return;
          // Render free tier cold-start retry up to 6 times (18 seconds)
          if (retryCountRef.current < 6) {
            retryCountRef.current += 1;
            setLoadingMessage(
              `Server sedang bersiap (membangunkan server... ${retryCountRef.current}/6)`
            );
            setTimeout(checkStatus, 3000);
          } else {
            setStatus("error");
          }
        });
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [key]);

  const [downloading, setDownloading] = useState(false);

  const downloadFile = async (fmt: "png" | "gif") => {
    const url = `${API_URL}/api/download/${key}?fmt=${fmt}`;
    setDownloading(true);

    // Try Web Share API on mobile (gives native "Save Image" option in iOS/Android)
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const ext = fmt === "gif" ? "gif" : "png";
          const mime = fmt === "gif" ? "image/gif" : "image/png";
          const file = new File([blob], `pckv-photostrip-${Date.now()}.${ext}`, { type: mime });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "PCKV Photostrip",
            });
            setDownloading(false);
            return;
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.log("Web Share dismissed, falling back to download link:", e);
        }
      }
    }

    // Direct browser download
    const link = document.createElement("a");
    link.href = url;
    link.download = `pckv-photostrip-${Date.now()}.${fmt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-4 sm:p-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900 font-serif mb-1">📸 PCKV Booth</h1>
        <p className="text-gray-500 text-sm">Unduh photostrip & GIF ke galeri HP kamu</p>
      </div>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 text-gray-500 py-12">
          <Loader size={28} className="animate-spin text-rose-600" />
          <span className="text-sm font-medium">{loadingMessage}</span>
          <p className="text-xs text-gray-400">Harap tunggu sebentar...</p>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center max-w-sm shadow-sm">
          <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-bold">Foto tidak ditemukan</p>
          <p className="text-red-500 text-xs mt-1.5 leading-relaxed">
            Link mungkin sudah kedaluwarsa atau server baru saja restart.<br />
            Silakan scan ulang QR Code terbaru dari layar komputer Photobooth.
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-lg p-5 border border-gray-100 w-full flex flex-col items-center">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-3">
              <CheckCircle size={16} />
              <span>Foto Siap Disimpan</span>
            </div>

            {/* Preview Photostrip */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 mb-3">
              <img
                src={`${API_URL}/api/download/${key}?fmt=png`}
                alt="Photostrip Final"
                className="w-full max-h-[55vh] object-contain mx-auto"
                loading="eager"
              />
            </div>

            <p className="text-[11px] text-gray-400 text-center mb-4">
              💡 <strong>Tip iPhone/Android:</strong> Tekan & tahan gambar di atas, lalu pilih <em>"Simpan ke Foto"</em> atau tap tombol di bawah.
            </p>

            {/* Download Buttons */}
            <button
              onClick={() => downloadFile("png")}
              disabled={downloading}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mb-2.5"
            >
              {downloading ? (
                <>
                  <Loader size={18} className="animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <Share2 size={18} /> Simpan ke HP / Unduh (PNG)
                </>
              )}
            </button>

            {hasGif && (
              <div className="w-full mt-3 pt-3 border-t border-gray-100 flex flex-col items-center">
                <div className="w-full rounded-xl overflow-hidden border border-gray-200 mb-2">
                  <img
                    src={`${API_URL}/api/download/${key}?fmt=gif`}
                    alt="GIF Boomerang"
                    className="w-full max-h-[30vh] object-contain mx-auto"
                  />
                </div>
                <button
                  onClick={() => downloadFile("gif")}
                  disabled={downloading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  {downloading ? (
                    <>
                      <Loader size={18} className="animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <Download size={18} /> Simpan / Unduh GIF
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            File disimpan sementara di server (± 1 jam).<br />
            PCKV Photobooth • Grafika Komputer & Pengolahan Citra
          </p>
        </div>
      )}
    </div>
  );
}
