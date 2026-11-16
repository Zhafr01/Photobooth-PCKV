import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePhotobooth } from "../store/photoboothStore";
import { Trash2, Edit3, ImageOff } from "lucide-react";

export default function GalleryPage() {
  const { state, dispatch } = usePhotobooth();
  const navigate = useNavigate();
  const gallery = state.sessionGallery;

  const handleEdit = (index: number) => {
    const item = gallery[index];
    dispatch({ type: "SET_CAPTURED_PHOTOS", payload: [item.fullImage] });
    dispatch({ type: "SET_CURRENT_INDEX", payload: 0 });
    navigate("/studio");
  };

  const handleDelete = (id: string) => {
    dispatch({ type: "REMOVE_GALLERY_ITEM", payload: id });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] bg-[#FAF7F2] p-6"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-serif">
            Galeri Sesi
          </h1>
          <p className="text-gray-500 text-sm mt-1">Foto yang diambil selama sesi ini ({gallery.length} foto)</p>
        </div>

        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
            <ImageOff size={64} className="opacity-30" />
            <p className="text-lg">Belum ada foto di galeri sesi ini.</p>
            <button
              onClick={() => navigate("/camera")}
              className="mt-2 px-6 py-3 bg-rose-600 text-white rounded-2xl font-semibold hover:bg-rose-700 active:scale-95 transition-all shadow"
            >
              Mulai Ambil Foto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {gallery.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="relative group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <img
                  src={`data:image/png;base64,${item.thumbnail}`}
                  alt={`Foto ${i + 1}`}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleEdit(i)}
                    className="p-2 bg-white rounded-full text-rose-600 hover:bg-rose-50 transition-colors shadow"
                    title="Edit di Studio"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="p-2 text-xs text-gray-500 truncate bg-white">
                  {new Date(item.createdAt).toLocaleTimeString("id-ID")}
                  {item.filters.length > 0 && (
                    <span className="ml-1 text-rose-600 font-medium">• {item.filters.length} filter</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
