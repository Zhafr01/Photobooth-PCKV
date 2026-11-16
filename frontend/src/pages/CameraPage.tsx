import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, FlipHorizontal, ArrowRight, RotateCcw,
  Upload, SlidersHorizontal, X, Layers, Clock, Video,
  Smartphone, CheckCircle2, Zap
} from "lucide-react";
import QRCode from "qrcode";
import Peer from "peerjs";
import { usePhotobooth } from "../store/photoboothStore";

type LiveFilter = "normal" | "bw" | "vintage" | "dreamy" | "vignette";
type Mode = "single" | "burst3" | "burst4" | "quick";

function applyLiveFilter(ctx: CanvasRenderingContext2D, w: number, h: number, filter: LiveFilter) {
  if (filter === "normal") return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (filter === "bw") {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
  } else if (filter === "vintage") {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * 1.1 + 20);
      d[i + 1] = Math.min(255, d[i + 1] * 0.9 + 10);
      d[i + 2] = Math.min(255, d[i + 2] * 0.7);
    }
  } else if (filter === "dreamy") {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * 1.05 + 10);
      d[i + 1] = Math.min(255, d[i + 1] * 1.0 + 5);
      d[i + 2] = Math.min(255, d[i + 2] * 1.1 + 15);
    }
  } else if (filter === "vignette") {
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const factor = Math.exp(-((r / maxR) ** 2) / (2 * 0.5 * 0.5));
        d[idx] *= factor;
        d[idx + 1] *= factor;
        d[idx + 2] *= factor;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

const LIVE_FILTERS: { id: LiveFilter; label: string; emoji: string }[] = [
  { id: "normal",  label: "Normal",  emoji: "○" },
  { id: "bw",      label: "B&W",     emoji: "◑" },
  { id: "vintage", label: "Vintage", emoji: "🎞" },
  { id: "dreamy",  label: "Dreamy",  emoji: "🌸" },
  { id: "vignette",label: "Vignette",emoji: "◉" },
];

const COUNTDOWN_OPTIONS = [3, 5, 10];

export default function CameraPage() {
  const navigate = useNavigate();
  const { dispatch } = usePhotobooth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peerRef = useRef<Peer | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => localStorage.getItem("pckv_camera_device_id") || ""
  );
  const [isMirrored, setIsMirrored] = useState(true);

  // Phone Camera WebRTC state
  const [, setBoothPeerId] = useState<string>("");
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneQrUrl, setPhoneQrUrl] = useState<string>("");

  const [liveFilter, setLiveFilter] = useState<LiveFilter>("normal");
  const [mode, setMode] = useState<Mode>("burst4");
  const [countdownSecs, setCountdownSecs] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const targetCount = mode === "single" ? 1 : mode === "burst3" ? 3 : 4;

  /* ── 1. Enumerate Video Devices (Laptop, USB, Capture Card) ── */
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn("Gagal membaca daftar perangkat kamera:", err);
    }
  }, [selectedDeviceId]);

  /* ── 2. Start Camera Stream (Local Webcam) ── */
  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn("navigator.mediaDevices.getUserMedia tidak tersedia (bukan HTTPS/localhost)");
      setCameraError(true);
      return;
    }

    // Hentikan stream webcam lokal yang lama
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    const constraints: MediaStreamConstraints = {
      video: deviceIdToUse
        ? { deviceId: { ideal: deviceIdToUse }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Pasang ke video element jika tidak sedang tersambung ke HP
      if (videoRef.current && !remoteStreamRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
        videoRef.current.play().catch(console.error);
      }
      setCameraError(false);
      refreshDevices();
    } catch (err) {
      console.warn("Primary camera constraints failed, trying generic video fallback:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        localStreamRef.current = fallbackStream;

        if (videoRef.current && !remoteStreamRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
          videoRef.current.play().catch(console.error);
        }
        setCameraError(false);
        refreshDevices();
      } catch (fallbackErr) {
        console.error("Camera completely unavailable or permission denied:", fallbackErr);
        setCameraError(true);
      }
    }
  }, [refreshDevices]);

  /* ── 3. PeerJS Listener for Phone Camera ── */
  useEffect(() => {
    const randomId = `booth-${Math.random().toString(36).substring(2, 8)}`;
    setBoothPeerId(randomId);

    const peer = new Peer(randomId);
    peerRef.current = peer;

    peer.on("call", (call) => {
      call.answer();
      call.on("stream", (remotePhoneStream) => {
        // Hentikan webcam lokal agar tidak bentrok
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }

        remoteStreamRef.current = remotePhoneStream;
        if (videoRef.current) {
          videoRef.current.srcObject = remotePhoneStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
          videoRef.current.play().catch(console.error);
        }
        setPhoneConnected(true);
        setIsMirrored(false);
        setShowPhoneModal(false);
      });
    });

    // Generate QR code for phone remote (compatible with GitHub Pages HashRouter)
    const cleanPath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    const remoteUrl = `${window.location.origin}${cleanPath}#/remote-camera?peer=${randomId}`;
    QRCode.toDataURL(remoteUrl, { margin: 1, width: 220 })
      .then((qr) => setPhoneQrUrl(qr))
      .catch(console.error);

    return () => {
      peer.destroy();
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    };
  }, []);

  /* ── 4. Lifecycle: Init Camera & Device Listener ── */
  useEffect(() => {
    let isCancelled = false;

    if (!phoneConnected) {
      startCamera(selectedDeviceId || undefined).then(() => {
        if (isCancelled && localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
      });
    }

    const handleDeviceChange = () => refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    return () => {
      isCancelled = true;
      // PENTING: Hanya hentikan localStream, JANGAN hentikan remoteStream (kamera HP)!
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
    };
  }, [selectedDeviceId, startCamera, refreshDevices, phoneConnected]);

  const handleSelectCamera = (deviceId: string) => {
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    setPhoneConnected(false);
    setSelectedDeviceId(deviceId);
    localStorage.setItem("pckv_camera_device_id", deviceId);
  };

  /* ── 5. Capture Photo & Video Sesi Recording ── */
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Enable high-quality smoothing for sharp captures
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply active live filter to captured snapshot
    applyLiveFilter(ctx, canvas.width, canvas.height, liveFilter);

    const b64 = canvas.toDataURL("image/png", 1.0).split(",")[1];
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setCapturedPhotos((prev) => [...prev, b64]);
  }, [isMirrored, liveFilter]);

  // Start MediaRecorder for Video Sesi
  const startRecordingVideo = useCallback(() => {
    const activeStream = remoteStreamRef.current || localStreamRef.current;
    if (!activeStream) return;
    try {
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(activeStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "",
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);
        dispatch({ type: "SET_SESSION_VIDEO", payload: videoUrl });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder tidak didukung:", err);
    }
  }, [dispatch]);

  const stopRecordingVideo = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /* ── 7. Shutter Logic (Regular & Quick Mode) ── */
  const handleShutter = useCallback(() => {
    if (countdown !== null || capturedPhotos.length >= targetCount) return;

    if (capturedPhotos.length === 0) {
      startRecordingVideo();
    }

    if (mode === "quick") {
      // QUICK MODE: Automated 4-shot sequence
      let currentShot = 0;
      const takeNextShot = () => {
        let c = 3;
        setCountdown(c);
        const timerId = setInterval(() => {
          c -= 1;
          if (c <= 0) {
            clearInterval(timerId);
            setCountdown(null);
            capturePhoto();
            currentShot += 1;
            if (currentShot < 4) {
              setTimeout(takeNextShot, 1200);
            } else {
              stopRecordingVideo();
              setTimeout(() => {
                navigate("/photostrip");
              }, 1500);
            }
          } else {
            setCountdown(c);
          }
        }, 1000);
      };
      takeNextShot();
      return;
    }

    // Regular Mode
    let c = countdownSecs;
    setCountdown(c);
    const id = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(id);
        setCountdown(null);
        capturePhoto();
        if (capturedPhotos.length + 1 >= targetCount) {
          stopRecordingVideo();
        }
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, [countdown, capturedPhotos.length, targetCount, countdownSecs, capturePhoto, mode, startRecordingVideo, stopRecordingVideo, navigate]);

  const handleRetake = () => {
    setCapturedPhotos([]);
    dispatch({ type: "SET_SESSION_VIDEO", payload: null });
  };

  const handleProceed = () => {
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: capturedPhotos });
    navigate("/studio");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const photos: string[] = [];
    for (const file of Array.from(files)) {
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = (ev) => res((ev.target?.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      photos.push(b64);
    }
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: photos });
    navigate("/studio");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full bg-black overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Native Camera Video Element (Hardware-Accelerated Viewfinder) ── */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-200 ${
          isMirrored ? "-scale-x-100" : ""
        }`}
        style={{
          filter:
            liveFilter === "bw"
              ? "grayscale(100%) contrast(110%)"
              : liveFilter === "vintage"
              ? "sepia(60%) contrast(115%) brightness(95%)"
              : liveFilter === "dreamy"
              ? "brightness(110%) saturate(125%) contrast(95%)"
              : "none",
        }}
      />

      {/* Vignette Overlay for Live View */}
      {liveFilter === "vignette" && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.75) 100%)",
          }}
        />
      )}

      {/* Off-screen canvas used exclusively for snapshot captures */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="absolute inset-0 bg-white z-30 pointer-events-none"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* Error Fallback */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 gap-4 text-center p-6">
          <Camera size={56} className="text-gray-500" />
          <h2 className="text-white text-xl font-bold">Kamera Tidak Terdeteksi / Izin Diblokir</h2>
          <p className="text-gray-400 text-sm max-w-md">
            {!navigator?.mediaDevices?.getUserMedia
              ? "Browser memblokir kamera karena dibuka via IP HTTP lokal (Not Secure). Buka website langsung menggunakan http://localhost:5173/PhotoboothPCKV/camera di laptop Anda."
              : "Pastikan webcam laptop atau kamera eksternal (USB/HP/Capture Card) sudah terpasang dan izin kamera diizinkan."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {window.location.hostname !== "localhost" && (
              <button
                onClick={() => {
                  window.location.href = window.location.href.replace(window.location.hostname, "localhost");
                }}
                className="px-5 py-2.5 bg-rose-600 rounded-2xl text-white font-medium hover:bg-rose-700"
              >
                Buka via Localhost
              </button>
            )}
            <button
              onClick={() => setShowPhoneModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-2xl text-white font-medium hover:bg-white/20"
            >
              <Smartphone size={18} /> Sambungkan Kamera HP
            </button>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-white/10 rounded-2xl text-white font-medium cursor-pointer hover:bg-white/20">
              <Upload size={18} /> Unggah Foto
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Top-Left: Shot counter & Camera source indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/10">
          {mode === "quick" ? "⚡ QUICK MODE" : `${capturedPhotos.length} / ${targetCount} FOTO`}
        </div>
        {phoneConnected && (
          <div className="bg-emerald-600/90 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Smartphone size={13} /> HP Terhubung
          </div>
        )}
      </div>

      {/* Top-Right: Quick Actions */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setShowPhoneModal(true)}
          className={`px-3 py-2 rounded-full backdrop-blur-sm text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 ${
            phoneConnected ? "bg-emerald-600 text-white" : "bg-black/60 text-white hover:bg-black/80"
          }`}
          title="Koneksi Kamera HP"
        >
          <Smartphone size={16} />
          <span className="hidden sm:inline">Kamera HP</span>
        </button>

        <button
          onClick={() => setIsMirrored((prev) => !prev)}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            isMirrored ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title={isMirrored ? "Cermin: Aktif" : "Cermin: Mati"}
        >
          <FlipHorizontal size={18} />
        </button>

        <button
          onClick={() => setSidebarOpen((p) => !p)}
          className={`w-10 h-10 rounded-full backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10 ${
            sidebarOpen ? "bg-rose-600" : "bg-black/60 hover:bg-black/80"
          }`}
          title="Pengaturan"
        >
          {sidebarOpen ? <X size={19} /> : <SlidersHorizontal size={18} />}
        </button>
      </div>

      {/* Right Sidebar: Settings & Camera Selector */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: 280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 280, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute top-0 right-0 h-full w-72 z-20 bg-black/85 backdrop-blur-md flex flex-col gap-5 p-5 pt-20 border-l border-white/10 overflow-y-auto"
          >
            {/* Camera Selector */}
            <div>
              <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                <Video size={13} className="text-rose-500" /> Sumber Kamera
              </p>
              <select
                value={phoneConnected ? "phone" : selectedDeviceId}
                onChange={(e) => {
                  if (e.target.value === "phone") {
                    setShowPhoneModal(true);
                  } else {
                    handleSelectCamera(e.target.value);
                  }
                }}
                className="w-full bg-white/10 text-white text-xs rounded-xl p-2.5 border border-white/20 focus:outline-none focus:border-rose-500"
              >
                {phoneConnected && <option value="phone" className="bg-gray-900 text-emerald-400">📱 Kamera HP (Wireless)</option>}
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-gray-900 text-white">
                    {device.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowPhoneModal(true)}
                className="mt-2 w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Smartphone size={14} className="text-rose-400" /> Hubungkan Kamera HP
              </button>
            </div>

            {/* Mode Selector (Single, Burst, Quick Mode) */}
            <div>
              <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                <Layers size={13} className="text-rose-500" /> Mode Foto
              </p>
              <div className="flex flex-col gap-1.5">
                {[
                  { id: "single", label: "1 Foto (Single)" },
                  { id: "burst3", label: "3 Foto (Burst)" },
                  { id: "burst4", label: "4 Foto (Photostrip)" },
                  { id: "quick", label: "⚡ Quick Mode (1-Sentuhan)" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id as Mode);
                      setCapturedPhotos([]);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium text-left transition-all ${
                      mode === m.id
                        ? "bg-rose-600 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Selector */}
            {mode !== "quick" && (
              <div>
                <p className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider mb-2">
                  <Clock size={13} className="text-rose-500" /> Timer Hitung Mundur
                </p>
                <div className="flex gap-2">
                  {COUNTDOWN_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setCountdownSecs(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        countdownSecs === s
                          ? "bg-rose-600 text-white"
                          : "bg-white/10 text-gray-300 hover:bg-white/20"
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback upload */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <label className="flex items-center justify-center gap-2 py-2.5 w-full rounded-xl bg-white/10 text-gray-200 text-xs font-medium cursor-pointer hover:bg-white/20 transition-colors">
                <Upload size={15} /> Unggah Berkas Foto
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Center: Live Filter Overlay Pill */}
      <div className="absolute bottom-28 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/10 shadow-lg">
          {LIVE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setLiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                liveFilter === f.id ? "bg-rose-600 text-white shadow-sm" : "text-gray-300 hover:bg-white/10"
              }`}
            >
              <span className="text-sm">{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Countdown Big Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <span className="text-[10rem] font-black text-white drop-shadow-2xl leading-none select-none">
              {countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Shutter Button */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
        <button
          onClick={handleShutter}
          disabled={countdown !== null || (mode !== "quick" && capturedPhotos.length >= targetCount)}
          className="w-20 h-20 rounded-full bg-rose-600 shadow-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-700 active:scale-95 transition-all border-4 border-white/30"
          title="Ambil Foto"
        >
          {mode === "quick" ? <Zap size={34} className="text-white" /> : <Camera size={34} className="text-white" />}
        </button>
      </div>

      {/* Thumbnail Strip */}
      <AnimatePresence>
        {capturedPhotos.length > 0 && mode !== "quick" && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 z-25 bg-black/90 border-t border-white/10 py-3 px-4"
          >
            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {capturedPhotos.map((photo, i) => (
                  <img
                    key={i}
                    src={`data:image/png;base64,${photo}`}
                    alt={`Foto ${i + 1}`}
                    className="h-14 w-14 object-cover rounded-lg border-2 border-rose-600 flex-shrink-0"
                  />
                ))}
                {Array.from({ length: Math.max(0, targetCount - capturedPhotos.length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="h-14 w-14 rounded-lg border-2 border-dashed border-white/20 flex-shrink-0 flex items-center justify-center"
                  >
                    <Camera size={16} className="text-white/30" />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleRetake}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 rounded-xl text-xs font-medium text-white hover:bg-white/20 transition-colors"
                >
                  <RotateCcw size={14} /> Ulang
                </button>
                {capturedPhotos.length >= targetCount && (
                  <button
                    onClick={handleProceed}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 rounded-xl text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                  >
                    Lanjut ke Studio <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Phone as External Camera Connector */}
      <AnimatePresence>
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-white/10 text-white rounded-3xl max-w-md w-full p-6 relative"
            >
              <button
                onClick={() => setShowPhoneModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 mb-2 text-rose-500 font-semibold text-sm">
                <Smartphone size={18} /> Sambungkan Kamera HP
              </div>
              <h3 className="text-lg font-bold mb-4">Gunakan HP Sebagai Kamera Booth</h3>

              {phoneConnected ? (
                <div className="text-center py-6 bg-emerald-950/40 rounded-2xl border border-emerald-500/30 mb-4">
                  <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-white">HP Anda Sudah Terhubung!</p>
                  <p className="text-xs text-gray-300 mt-1">Live video stream dari kamera HP sedang aktif.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center bg-black/50 p-4 rounded-2xl border border-white/10 mb-4">
                  {phoneQrUrl ? (
                    <img src={phoneQrUrl} alt="QR Code Kamera HP" className="w-48 h-48 rounded-xl bg-white p-2" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                      Membuat QR Code...
                    </div>
                  )}
                  <p className="text-xs text-gray-300 text-center mt-3">
                    Scan QR Code ini menggunakan kamera smartphone Anda. Kamera HP akan otomatis tersambung ke layar booth.
                  </p>
                </div>
              )}

              <div className="bg-white/5 p-3 rounded-xl text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-white">Alternatif Kabel USB (0-Latency HD):</p>
                <p>1. Pasang aplikasi <strong>DroidCam</strong> atau <strong>Iriun Webcam</strong> di HP dan PC.</p>
                <p>2. Hubungkan HP via USB, kamera HP akan langsung muncul di dropdown <em>Sumber Kamera</em>.</p>
              </div>

              <button
                onClick={() => setShowPhoneModal(false)}
                className="mt-4 w-full py-3 bg-rose-600 rounded-xl text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                {phoneConnected ? "Gunakan Kamera HP Ini" : "Tutup"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
