import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, BookOpen, Image } from "lucide-react";
import { useRef } from "react";
import { usePhotobooth } from "../store/photoboothStore";
import { fileToBase64 } from "../utils/imageUtils";

export default function HomePage() {
  const navigate = useNavigate();
  const { dispatch } = usePhotobooth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const photos: string[] = [];
    for (const file of Array.from(files)) {
      const b64 = await fileToBase64(file);
      photos.push(b64);
    }
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: photos });
    navigate("/studio");
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] relative flex flex-col items-center justify-center px-4">
      {/* Main content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        {/* Badge / Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-6">
          <Camera size={14} /> Digital Photobooth PCKV
        </div>

        {/* Clean Solid Title (No Stars, No Gradient) */}
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-gray-900 font-serif mb-4">
          PHOTOBOOTH
        </h1>

        <p className="text-lg md:text-xl text-gray-700 mb-2 font-serif italic">
          Tangkap momen, tambahkan sentuhan filter digital
        </p>
        <p className="text-sm text-gray-500 mb-10 max-w-md mx-auto">
          Berbasis algoritma pengolahan citra — Transformasi Intensitas, Domain Frekuensi (FFT 2D), dan Operasi Aritmatika Citra
        </p>

        {/* Solid Color CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <button
            onClick={() => navigate("/camera")}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-rose-600 text-white rounded-2xl text-lg font-semibold shadow-md hover:bg-rose-700 active:scale-[0.98] transition-all"
          >
            <Camera size={22} />
            Mulai Photobooth
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-rose-600 text-rose-600 rounded-2xl text-lg font-semibold hover:bg-rose-50 active:scale-[0.98] transition-all"
          >
            <Upload size={22} />
            Unggah Foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Secondary links */}
        <div className="flex gap-6 justify-center">
          <button
            onClick={() => navigate("/gallery")}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-rose-600 transition-colors"
          >
            <Image size={16} />
            Galeri Sesi
          </button>
          <button
            onClick={() => navigate("/education")}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-rose-600 transition-colors"
          >
            <BookOpen size={16} />
            Behind the Filter
          </button>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 text-xs text-gray-400">
        PCKV Project — Pengolahan Citra Digital
      </div>
    </div>
  );
}
