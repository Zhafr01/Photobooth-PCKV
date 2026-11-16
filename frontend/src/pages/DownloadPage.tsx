/**
 * DownloadPage — halaman yang dibuka HP saat scan QR Code
 * QR mengarah ke backend: https://photobooth-pckv-backend.onrender.com/api/download/KEY
 * HP langsung download file dari Render backend (tersedia via internet)
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, CheckCircle, AlertCircle, Loader } from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export default function DownloadPage() {
  const [params] = useSearchParams();
  const key = params.get("key");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasGif, setHasGif] = useState(false);

  useEffect(() => {
    if (!key) { setStatus("error"); return; }
    // Check if key exists on backend
    fetch(`${API_URL}/api/download/${key}/info`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json() as Promise<{ has_png: boolean; has_gif: boolean }>;
      })
      .then((info) => {
        setHasGif(info.has_gif);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [key]);

  const downloadFile = (fmt: "png" | "gif") => {
    // Redirect to backend download URL — mobile browser triggers Save to Gallery
    window.location.href = `${API_URL}/api/download/${key}?fmt=${fmt}`;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900 font-serif mb-1">📸 PCKV Booth</h1>
        <p className="text-gray-500 text-sm">Unduh hasil foto ke galeri HP kamu</p>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader size={20} className="animate-spin" />
          <span>Menghubungi server...</span>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-semibold">Foto tidak ditemukan</p>
          <p className="text-red-500 text-sm mt-1">
            Link sudah kedaluwarsa atau server sedang restart.<br />
            Minta QR Code baru dari PC.
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 w-full">
            <CheckCircle size={24} className="text-green-500 mb-3" />
            <p className="text-sm text-gray-600 font-semibold mb-4">
              Foto siap diunduh! Tap tombol di bawah.
            </p>

            <button
              onClick={() => downloadFile("png")}
              className="w-full py-3 bg-rose-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors mb-3"
            >
              <Download size={18} /> Unduh Photostrip (PNG)
            </button>

            {hasGif && (
              <button
                onClick={() => downloadFile("gif")}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
              >
                <Download size={18} /> Unduh GIF Boomerang
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            File disimpan sementara di server (± 1 jam).<br />
            Scan ulang QR di PC jika link kedaluwarsa.
          </p>
        </div>
      )}
    </div>
  );
}
