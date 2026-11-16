import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import {
  Trash2, Download, ImageOff, Camera, Frame, X, Check
} from "lucide-react";
import type { GalleryItem } from "../types";

export default function GalleryPage() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();
  const gallery = state.sessionGallery;

  const [filterType, setFilterType] = useState<"all" | "strip" | "photo">("all");
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const checkIsStrip = (item: GalleryItem) => item.itemType === "strip" || item.id.startsWith("strip");

  const filteredItems = gallery.filter((item) => {
    const isStrip = checkIsStrip(item);
    if (filterType === "strip") return isStrip;
    if (filterType === "photo") return !isStrip;
    return true;
  });

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    dispatch({ type: "REMOVE_GALLERY_ITEM", payload: id });
    if (selectedItem?.id === id) setSelectedItem(null);
  };

  const handleClearAll = () => {
    if (window.confirm("Hapus seluruh riwayat foto dan photostrip di galeri sesi ini?")) {
      dispatch({ type: "CLEAR_GALLERY" });
      setSelectedItem(null);
    }
  };

  const handleDownload = (item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = document.createElement("a");
    link.href = item.fullImage.startsWith("data:")
      ? item.fullImage
      : `data:image/png;base64,${item.fullImage}`;
    const prefix = item.id.startsWith("strip") ? "Photobooth-Strip" : "Photobooth-Capture";
    link.download = `${prefix}-${new Date(item.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    link.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handleOpenInEditor = (item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: [item.fullImage] });
    navigate("/photostrip");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] p-4 sm:p-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif">
              Galeri Sesi Photobooth
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Tersimpan otomatis di sesi ini ({gallery.length} berkas)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/camera")}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Camera size={15} /> Ambil Foto
            </button>
            <button
              onClick={() => navigate("/photostrip")}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95"
            >
              <Frame size={15} className="text-rose-600" /> Bingkai & Stiker
            </button>
            {gallery.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                title="Hapus Semua Galeri"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        {gallery.length > 0 && (
          <div className="flex gap-1.5 mb-6 border-b border-gray-200 pb-3">
            {[
              { id: "all", label: `Semua (${gallery.length})` },
              { id: "strip", label: `Photostrip (${gallery.filter(checkIsStrip).length})` },
              { id: "photo", label: `Foto Satuan (${gallery.filter((g) => !checkIsStrip(g)).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === tab.id
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-200/80 text-gray-400 gap-4 shadow-xs">
            <ImageOff size={56} className="opacity-25" />
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700">
                {gallery.length === 0
                  ? "Belum ada foto atau photostrip di galeri."
                  : "Tidak ada berkas pada kategori ini."}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Foto yang diambil melalui Kamera dan desain bingkai dari Photostrip akan otomatis muncul di sini.
              </p>
            </div>
            <button
              onClick={() => navigate("/camera")}
              className="mt-1 px-6 py-2.5 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all shadow"
            >
              Mulai Foto Sekarang
            </button>
          </div>
        ) : (
          /* Grid of Gallery Items */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map((item, i) => {
              const isStrip = checkIsStrip(item);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedItem(item)}
                  className={`group relative bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all border border-gray-200/80 cursor-pointer flex flex-col ${
                    isStrip ? "row-span-2" : ""
                  }`}
                >
                  <div className={`relative w-full overflow-hidden bg-gray-50 flex items-center justify-center ${
                    isStrip ? "aspect-[1/2.8] p-2" : "aspect-square"
                  }`}>
                    <img
                      src={item.thumbnail.startsWith("data:") ? item.thumbnail : `data:image/png;base64,${item.thumbnail}`}
                      alt="Hasil Foto"
                      className={`w-full h-full ${isStrip ? "object-contain rounded-lg shadow-xs" : "object-cover group-hover:scale-105 transition-transform duration-300"}`}
                      loading="lazy"
                    />

                    {/* Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs ${
                        isStrip ? "bg-rose-600 text-white" : "bg-black/60 text-white"
                      }`}>
                        {isStrip ? "🎞 Strip" : "📷 Foto"}
                      </span>
                    </div>

                    {/* Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        onClick={(e) => handleDownload(item, e)}
                        className="p-2.5 bg-white rounded-full text-rose-600 hover:bg-rose-50 transition-colors shadow-md"
                        title="Unduh PNG"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-2.5 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-md"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Footer item info */}
                  <div className="p-2 text-[11px] text-gray-500 bg-white flex items-center justify-between border-t border-gray-100">
                    <span className="truncate">{new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-[10px] text-rose-600 font-medium">Buka</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox Modal Preview ── */}
      <AnimatePresence>
        {selectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-3xl p-5 max-w-xl w-full flex flex-col max-h-[90vh] text-white shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full bg-white/10"
                title="Tutup"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  {selectedItem.id.startsWith("strip") ? "Photobooth Strip" : "Hasil Foto"}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  • {new Date(selectedItem.createdAt).toLocaleString("id-ID")}
                </span>
              </div>

              {/* Image Preview */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-black/40 rounded-2xl mb-4 max-h-[62vh]">
                <img
                  src={selectedItem.fullImage.startsWith("data:") ? selectedItem.fullImage : `data:image/png;base64,${selectedItem.fullImage}`}
                  alt="Detail Foto"
                  className="max-h-[58vh] max-w-full rounded-xl object-contain shadow-lg"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={(e) => handleDelete(selectedItem.id, e)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Trash2 size={15} /> Hapus
                </button>

                <div className="flex items-center gap-2">
                  {!selectedItem.id.startsWith("strip") && (
                    <button
                      onClick={(e) => handleOpenInEditor(selectedItem, e)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Frame size={15} className="text-rose-400" /> Buat Strip
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDownload(selectedItem, e)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    {downloadSuccess ? <Check size={16} /> : <Download size={16} />}
                    <span>{downloadSuccess ? "Tersimpan!" : "Unduh Foto (PNG)"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
