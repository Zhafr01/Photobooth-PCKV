import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FlipHorizontal, CheckCircle, Wifi, AlertCircle } from "lucide-react";
import Peer, { type MediaConnection, type DataConnection } from "peerjs";

export default function RemoteCameraPage() {
  const [searchParams] = useSearchParams();
  const targetPeerId = searchParams.get("peer");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const facingModeRef = useRef<"environment" | "user">("environment");
  facingModeRef.current = facingMode;

  const [status, setStatus] = useState<"connecting" | "streaming" | "error">("connecting");
  const [statusMessage, setStatusMessage] = useState("Menghubungkan ke Photobooth...");

  // Toggle front/back camera with WebRTC replaceTrack
  const switchCamera = useCallback(async (newFacing?: "environment" | "user") => {
    const nextFacing = newFacing || (facingModeRef.current === "environment" ? "user" : "environment");
    try {
      // 1. MUST stop existing stream tracks FIRST so hardware releases camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // 2. Request new facing mode with fallback
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: false,
        });
      }

      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(console.error);
      }

      setFacingMode(nextFacing);
      facingModeRef.current = nextFacing;

      // 3. Notify booth via data channel
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: "FACING_CHANGED", facingMode: nextFacing });
      }

      // 4. Seamlessly replace the WebRTC video track without dropping the call
      const newTrack = newStream.getVideoTracks()[0];
      const senders = (callRef.current as any)?.peerConnection?.getSenders?.() as RTCRtpSender[] | undefined;
      const videoSender = senders?.find((s) => s.track?.kind === "video");
      if (videoSender && newTrack) {
        await videoSender.replaceTrack(newTrack);
      } else if (peerRef.current && targetPeerId) {
        // Fallback: re-call
        const newCall = peerRef.current.call(targetPeerId, newStream);
        callRef.current = newCall;
      }
    } catch (err) {
      console.warn("Gagal mengganti kamera HP:", err);
      setStatusMessage("Gagal mengganti kamera. Pastikan izin kamera aktif.");
    }
  }, [targetPeerId]);

  useEffect(() => {
    let active = true;

    async function initPhoneStream() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("error");
        setStatusMessage(
          "Browser HP Anda memblokir kamera pada koneksi HTTP (Not Secure). Gunakan HTTPS atau izinkan akses kamera di pengaturan browser."
        );
        return;
      }
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingModeRef.current,
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
          videoRef.current.play().catch(console.error);
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
          callRef.current = call;

          // Connect data channel so booth can signal camera flip
          const conn = peer.connect(targetPeerId);
          connRef.current = conn;
          conn.on("data", (data: any) => {
            if (data?.type === "FLIP_CAMERA") {
              switchCamera();
            }
          });

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
      connRef.current?.close();
      callRef.current?.close();
      peerRef.current?.destroy();
    };
  }, [targetPeerId, switchCamera]);

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
          onClick={() => switchCamera()}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1.5"
          title="Ganti Kamera Depan / Belakang"
        >
          <FlipHorizontal size={18} />
          <span className="text-xs font-medium hidden sm:inline">Balik</span>
        </button>
      </div>

      {/* Live Camera Viewfinder */}
      <div className="w-full flex-1 my-3 flex items-center justify-center relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-xs font-mono px-3 py-1.5 rounded-full text-white border border-white/10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {facingMode === "environment" ? "📷 Kamera Belakang (HD)" : "🤳 Kamera Depan (Selfie)"}
        </div>

        {/* Floating Flip Button on Phone Screen for easy thumb tap */}
        <button
          onClick={() => switchCamera()}
          className="absolute bottom-4 right-4 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-3.5 rounded-full shadow-2xl backdrop-blur-sm transition-all border border-white/20"
          title="Ganti Kamera"
        >
          <FlipHorizontal size={22} />
        </button>
      </div>

      {/* Primary Thumb Switch Button */}
      <div className="w-full max-w-md pb-2">
        <button
          onClick={() => switchCamera()}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all border border-rose-500"
        >
          <FlipHorizontal size={20} />
          <span>Pindah ke Kamera {facingMode === "environment" ? "Depan (Selfie)" : "Belakang (HD)"}</span>
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2">
          Arahkan HP ke subjek foto. Layar booth akan menampilkan live preview secara langsung.
        </p>
      </div>
    </div>
  );
}
