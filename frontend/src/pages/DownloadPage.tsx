/**
 * DownloadPage — halaman yang dibuka HP saat scan QR Code
 * URL: /#/download?key=XXXX
 * Membaca data photostrip dari localStorage, lalu langsung trigger download ke galeri HP.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, CheckCircle, AlertCircle, Loader } from "lucide-react";

export default function DownloadPage() {
  const [params] = useSearchParams();
  const key = params.get("key");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [imgSrc, setImgSrc] = useState<string>("");
  const [gifSrc, setGifSrc] = useState<string>("");

  useEffect(() => {
    if (!key) { setStatus("error"); return; }
    try {
      const stored = localStorage.getItem(`pckv_download_${key}`);
      if (!stored) { setStatus("error"); return; }
      const data = JSON.parse(stored) as { photostrip?: string; gif?: string };
      if (data.photostrip) setImgSrc(`data:image/png;base64,${data.photostrip}`);
      if (data.gif) setGifSrc(data.gif);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [key]);

  const downloadFile = (src: string, filename: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <span>Memuat foto...</span>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-semibold">Foto tidak ditemukan</p>
          <p className="text-red-500 text-sm mt-1">
            Link sudah kedaluwarsa atau tidak valid.<br />
            Minta QR Code baru dari PC.
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 w-full">
            <CheckCircle size={20} className="text-green-500 mb-2" />
            <p className="text-xs text-gray-500 mb-3">Tap tombol di bawah untuk menyimpan ke galeri HP</p>

            {imgSrc && (
              <div className="mb-4">
                <img src={imgSrc} alt="Photostrip" className="w-full rounded-xl mb-2 shadow-sm" />
                <button
                  onClick={() => downloadFile(imgSrc, `pckv-photostrip-${Date.now()}.png`)}
                  className="w-full py-3 bg-rose-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors"
                >
                  <Download size={18} /> Unduh Photostrip (PNG)
                </button>
              </div>
            )}

            {gifSrc && (
              <div>
                <img src={gifSrc} alt="GIF Boomerang" className="w-full rounded-xl mb-2 shadow-sm" />
                <button
                  onClick={() => downloadFile(gifSrc, `pckv-boomerang-${Date.now()}.gif`)}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
                >
                  <Download size={18} /> Unduh GIF Boomerang
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            File disimpan sementara di browser PC ini.<br />
            Hanya bisa diakses dari jaringan WiFi yang sama.
          </p>
        </div>
      )}
    </div>
  );
}
