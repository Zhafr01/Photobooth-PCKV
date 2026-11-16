import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FlipHorizontal, CheckCircle, Wifi, AlertCircle } from "lucide-react";
import Peer from "peerjs";

export default function RemoteCameraPage() {
  const [searchParams] = useSearchParams();
  const targetPeerId = searchParams.get("peer");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState<"connecting" | "streaming" | "error">("connecting");
  const [statusMessage, setStatusMessage] = useState("Menghubungkan ke Photobooth...");

  useEffect(() => {
    let active = true;

    async function initPhoneStream() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("error");
        setStatusMessage("Browser HP Anda memblokir kamera pada koneksi HTTP (Not Secure). Gunakan HTTPS atau izinkan akses kamera di pengaturan browser.");
        return;
      }
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        if (!targetPeerId) {
          setStatus("error");
          setStatusMessage("ID Booth tidak ditemukan. Silakan scan ulang QR dari layar Booth.");
          return;
        }

        // Initialize Peer connection
        const peer = new Peer();
        peerRef.current = peer;

        peer.on("open", () => {
          setStatusMessage("Tersambung ke server, memanggil booth...");
          const call = peer.call(targetPeerId, stream);

          call.on("close", () => {
            setStatus("error");
            setStatusMessage("Koneksi ke booth terputus.");
          });

          setStatus("streaming");
          setStatusMessage("Kamera HP terhubung! Sedang live streaming ke Photobooth.");
        });

        peer.on("error", (err) => {
          console.error("Peer error:", err);
          setStatus("error");
          setStatusMessage("Gagal menyambung ke booth. Pastikan koneksi internet stabil.");
        });
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("error");
        setStatusMessage("Izin kamera ditolak atau perangkat tidak mendukung.");
      }
    }

    initPhoneStream();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
  }, [targetPeerId, facingMode]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4 relative">
      {/* Top Status Banner */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between z-10 border border-white/10">
        <div className="flex items-center gap-3">
          {status === "streaming" ? (
            <CheckCircle className="text-emerald-400" size={24} />
          ) : status === "connecting" ? (
            <Wifi className="text-yellow-400 animate-pulse" size={24} />
          ) : (
            <AlertCircle className="text-rose-500" size={24} />
          )}
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Status Kamera HP</p>
            <p className="text-xs font-medium text-white">{statusMessage}</p>
          </div>
        </div>

        <button
          onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
          title="Ganti Kamera Depan / Belakang"
        >
          <FlipHorizontal size={18} />
        </button>
      </div>

      {/* Live Camera Viewfinder */}
      <div className="w-full flex-1 my-4 flex items-center justify-center relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-xs font-mono px-3 py-1 rounded-full text-gray-300">
          {facingMode === "environment" ? "Kamera Belakang (HD)" : "Kamera Depan"}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 pb-2">
        Arahkan kamera ke subjek foto. Layar booth akan menampilkan live preview secara langsung.
      </div>
    </div>
  );
}
