import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, RotateCcw, Loader, ChevronRight, ChevronLeft, Trash2, GripVertical } from "lucide-react";
import { usePhotobooth } from "../store/photoboothStore";
import FilterCard from "../components/FilterCard";
import ParameterSlider from "../components/ParameterSlider";
import { applyFilter } from "../services/api";
import { resizeImageToBase64 } from "../utils/imageUtils";
import type { FilterDefinition, FilterChain } from "../types";

const FILTERS: FilterDefinition[] = [
  // Tone
  { id: "film_negative", name: "Film Negative", category: "tone", categoryLabel: "Tone", description: "Inversi nilai piksel", params: [], gradientFrom: "#1a1a1a", gradientTo: "#f0f0f0" },
  { id: "shadow_lift", name: "Shadow Lift", category: "tone", categoryLabel: "Tone", description: "Angkat bayangan dengan log", params: [], gradientFrom: "#2d1b69", gradientTo: "#ffeaa7" },
  { id: "gamma_transform", name: "Gamma Transform", category: "tone", categoryLabel: "Tone", description: "Koreksi gamma", params: [{ name: "gamma", label: "Gamma", type: "range", min: 0.1, max: 3.0, step: 0.1, default: 1.0 }], gradientFrom: "#6c5ce7", gradientTo: "#fd79a8" },
  { id: "contrast_stretch", name: "Contrast Stretch", category: "tone", categoryLabel: "Tone", description: "Peregangan kontras", params: [{ name: "r1", label: "r1", type: "range", min: 0, max: 128, step: 1, default: 64 }, { name: "s1", label: "s1", type: "range", min: 0, max: 255, step: 1, default: 0 }, { name: "r2", label: "r2", type: "range", min: 128, max: 255, step: 1, default: 192 }, { name: "s2", label: "s2", type: "range", min: 0, max: 255, step: 1, default: 255 }], gradientFrom: "#fdcb6e", gradientTo: "#e17055" },
  { id: "histogram_equalization", name: "Hist. Equalization", category: "tone", categoryLabel: "Tone", description: "Equalisasi histogram", params: [{ name: "blend", label: "Blend", type: "range", min: 0, max: 1, step: 0.05, default: 1.0 }], gradientFrom: "#00b894", gradientTo: "#00cec9" },
  { id: "retro_8bit", name: "Retro 8-bit", category: "tone", categoryLabel: "Tone", description: "Reduksi bit-depth", params: [{ name: "k", label: "Bit level (k)", type: "range", min: 1, max: 8, step: 1, default: 4 }], gradientFrom: "#6c5ce7", gradientTo: "#00cec9" },
  { id: "spotlight", name: "Spotlight", category: "tone", categoryLabel: "Tone", description: "Sorot rentang intensitas", params: [{ name: "low", label: "Low", type: "range", min: 0, max: 200, step: 1, default: 100 }, { name: "high", label: "High", type: "range", min: 50, max: 255, step: 1, default: 200 }, { name: "dim_factor", label: "Dim", type: "range", min: 0, max: 1, step: 0.05, default: 0.1 }], gradientFrom: "#f9ca24", gradientTo: "#6ab04c" },
  // Frequency
  { id: "dreamy_soft", name: "Dreamy Soft", category: "frequency", categoryLabel: "Frekuensi", description: "Gaussian Low-Pass Filter", params: [{ name: "d0", label: "Cutoff (d0)", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }], gradientFrom: "#a29bfe", gradientTo: "#fd79a8" },
  { id: "ghost_glitch", name: "Ghost Glitch", category: "frequency", categoryLabel: "Frekuensi", description: "Ideal Low-Pass Filter", params: [{ name: "d0", label: "Cutoff (d0)", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }], gradientFrom: "#2d3436", gradientTo: "#00b894" },
  { id: "butterworth_soft", name: "Butterworth Soft", category: "frequency", categoryLabel: "Frekuensi", description: "Butterworth Low-Pass", params: [{ name: "d0", label: "Cutoff", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }, { name: "n", label: "Order", type: "range", min: 1, max: 10, step: 1, default: 2 }], gradientFrom: "#0984e3", gradientTo: "#74b9ff" },
  { id: "detail_pop", name: "Detail Pop", category: "frequency", categoryLabel: "Frekuensi", description: "High-boost sharpening", params: [{ name: "d0", label: "Cutoff", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }, { name: "k1", label: "k1", type: "range", min: 0, max: 3, step: 0.1, default: 1.0 }, { name: "k2", label: "k2", type: "range", min: 0, max: 5, step: 0.1, default: 1.5 }], gradientFrom: "#fdcb6e", gradientTo: "#e17055" },
  { id: "sketch_edge", name: "Sketch Edge", category: "frequency", categoryLabel: "Frekuensi", description: "Gaussian High-Pass (edge)", params: [{ name: "d0", label: "Cutoff", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }], gradientFrom: "#636e72", gradientTo: "#dfe6e9" },
  { id: "fix_backlight", name: "Fix Backlight", category: "frequency", categoryLabel: "Frekuensi", description: "Homomorphic filtering", params: [{ name: "d0", label: "Cutoff", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1 }, { name: "gl", label: "γl", type: "range", min: 0.1, max: 1.5, step: 0.05, default: 0.5 }, { name: "gh", label: "γh", type: "range", min: 1.0, max: 5.0, step: 0.1, default: 2.0 }], gradientFrom: "#f9ca24", gradientTo: "#e55039" },
  { id: "anti_moire", name: "Anti Moiré", category: "frequency", categoryLabel: "Frekuensi", description: "Notch reject filter", params: [{ name: "u0_norm", label: "u0", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.3 }, { name: "v0_norm", label: "v0", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.0 }, { name: "r_norm", label: "Radius", type: "range", min: 0.01, max: 0.2, step: 0.01, default: 0.05 }], gradientFrom: "#6c5ce7", gradientTo: "#00cec9" },
  // Artistic
  { id: "vignette", name: "Vignette", category: "artistic", categoryLabel: "Artistik", description: "Efek vignette Gaussian", params: [{ name: "sigma", label: "Sigma", type: "range", min: 0.1, max: 1.5, step: 0.05, default: 0.5 }], gradientFrom: "#2d3436", gradientTo: "#b2bec3" },
  { id: "double_exposure", name: "Double Exposure", category: "artistic", categoryLabel: "Artistik", description: "Overlay tekstur sintetis", params: [{ name: "alpha", label: "Alpha", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 }, { name: "texture_type", label: "Texture", type: "select", default: "gradient", options: [{ value: "gradient", label: "Gradient" }, { value: "noise", label: "Noise" }] }], gradientFrom: "#e17055", gradientTo: "#6c5ce7" },
  { id: "low_light_denoise", name: "Low-light Denoise", category: "artistic", categoryLabel: "Artistik", description: "Denoise multi-frame averaging", params: [{ name: "n_frames", label: "Frames", type: "range", min: 2, max: 10, step: 1, default: 4 }, { name: "noise_std", label: "Noise std", type: "range", min: 1, max: 50, step: 1, default: 20 }], gradientFrom: "#2d3436", gradientTo: "#6c5ce7" },
  { id: "masking_stencil", name: "Masking Stencil", category: "artistic", categoryLabel: "Artistik", description: "Masker stensil dengan feathering", params: [{ name: "shape", label: "Shape", type: "select", default: "circle", options: [{ value: "circle", label: "Circle" }, { value: "rect", label: "Rectangle" }] }, { name: "feather", label: "Feather", type: "range", min: 0, max: 30, step: 1, default: 5 }], gradientFrom: "#fd79a8", gradientTo: "#fdcb6e" },
  // Spatial
  { id: "spatial_median", name: "Spatial Median", category: "spatial", categoryLabel: "Spasial", description: "Filter median spasial", params: [], gradientFrom: "#00b894", gradientTo: "#55efc4" },
  { id: "segment_background", name: "Segment Background", category: "spatial", categoryLabel: "Spasial", description: "Segmentasi latar Otsu + morfologi", params: [{ name: "kernel_size", label: "Kernel", type: "range", min: 3, max: 15, step: 2, default: 5 }], gradientFrom: "#0984e3", gradientTo: "#6c5ce7" },
  // Face
  { id: "face_spotlight", name: "Face Spotlight", category: "face", categoryLabel: "Wajah", description: "Spotlight wajah, background gelap", params: [], gradientFrom: "#f9ca24", gradientTo: "#2d3436" },
  { id: "face_smooth", name: "Face Smooth", category: "face", categoryLabel: "Wajah", description: "Haluskan kulit (box blur)", params: [{ name: "strength", label: "Kekuatan", type: "range", min: 0.1, max: 1.0, step: 0.05, default: 0.5 }], gradientFrom: "#fd79a8", gradientTo: "#e84393" },
  { id: "face_brighten", name: "Face Brighten", category: "face", categoryLabel: "Wajah", description: "Cerahkan wajah (brightness boost)", params: [{ name: "amount", label: "Jumlah", type: "range", min: 1.0, max: 1.5, step: 0.05, default: 1.2 }], gradientFrom: "#fdcb6e", gradientTo: "#e17055" },
  { id: "face_vignette", name: "Face Vignette", category: "face", categoryLabel: "Wajah", description: "Vignette fokus wajah (center bright)", params: [{ name: "strength", label: "Kekuatan", type: "range", min: 0.3, max: 1.0, step: 0.05, default: 0.7 }], gradientFrom: "#2d3436", gradientTo: "#6c5ce7" },
  { id: "face_cartoon", name: "Face Cartoon", category: "face", categoryLabel: "Wajah", description: "Kartun: quantisasi warna + edge", params: [], gradientFrom: "#00b894", gradientTo: "#fdcb6e" },
];

type Category = "tone" | "frequency" | "artistic" | "spatial" | "face";

function getDefaultParams(filter: FilterDefinition): Record<string, number | string> {
  const p: Record<string, number | string> = {};
  for (const param of filter.params) p[param.name] = param.default;
  return p;
}

export default function FilterStudio() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotobooth();

  const [category, setCategory] = useState<Category>("tone");
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number | string>>({});
  const [filterChain, setFilterChain] = useState<FilterChain[]>(state.activeFilters);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [filteredImage, setFilteredImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dividerX, setDividerX] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [histData, setHistData] = useState<{ original: number[]; filtered: number[] } | null>(null);
  const [spectrumImage, setSpectrumImage] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(state.currentPhotoIndex);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPhoto = state.capturedPhotos[photoIndex];

  useEffect(() => {
    if (currentPhoto) {
      setOriginalImage(currentPhoto);
      setFilteredImage(currentPhoto);
    }
  }, [currentPhoto]);

  const selectedFilter = FILTERS.find((f) => f.id === selectedFilterId);

  // Debounced filter apply
  useEffect(() => {
    if (!selectedFilterId || !originalImage) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const small = await resizeImageToBase64(`data:image/png;base64,${originalImage}`, 256);
        const result = await applyFilter(small, selectedFilterId, params, true);
        setFilteredImage(result.result_image);
        if (result.histogram_data) setHistData(result.histogram_data);
        if (result.spectrum_image) setSpectrumImage(result.spectrum_image);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, [selectedFilterId, params, originalImage]);

  const handleSelectFilter = (f: FilterDefinition) => {
    setSelectedFilterId(f.id);
    setParams(getDefaultParams(f));
  };

  const handleAddToChain = () => {
    if (!selectedFilterId) return;
    const chain: FilterChain = {
      id: `${selectedFilterId}-${Date.now()}`,
      filterType: selectedFilterId,
      params: { ...params },
    };
    setFilterChain((prev) => [...prev, chain]);
  };

  const handleRemoveChain = (id: string) => setFilterChain((prev) => prev.filter((c) => c.id !== id));

  const handleApplyAll = async () => {
    if (filterChain.length === 0 || state.capturedPhotos.length === 0) return;
    setLoading(true);
    try {
      const results: string[] = [];
      for (const photo of state.capturedPhotos) {
        let img = photo;
        for (const f of filterChain) {
          const small = await resizeImageToBase64(`data:image/png;base64,${img}`, 512);
          const res = await applyFilter(small, f.filterType, f.params, false);
          img = res.result_image;
        }
        results.push(img);
      }
      dispatch({ type: "SET_FILTERED_PHOTOS", payload: results });
      dispatch({ type: "SET_ACTIVE_FILTERS", payload: filterChain });
    } finally {
      setLoading(false);
    }
  };

  // Before/after divider drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setDividerX(Math.max(0.05, Math.min(0.95, x)));
  }, [dragging]);

  const filteredByCategory = FILTERS.filter((f) => f.category === category);

  const categoryTabs: { id: Category; label: string; emoji: string }[] = [
    { id: "tone", label: "Tone", emoji: "🎨" },
    { id: "frequency", label: "Frekuensi", emoji: "🌊" },
    { id: "artistic", label: "Artistik", emoji: "🎭" },
    { id: "spatial", label: "Spasial", emoji: "🔬" },
    { id: "face", label: "Wajah", emoji: "😊" },
  ];

  if (!currentPhoto) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Belum ada foto. Ambil foto dulu!</p>
          <button onClick={() => navigate("/camera")} className="px-6 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium">
            Ke Kamera
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-56px)] flex bg-gray-100"
    >
      {/* Left sidebar - filter list */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter</p>
        </div>
        {/* Category tabs */}
        <div className="flex border-b border-gray-100">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                category === tab.id ? "bg-rose-50 text-rose-600 border-b-2 border-rose-600 font-semibold" : "text-gray-500 hover:text-gray-700"
              }`}
              title={tab.label}
            >
              {tab.emoji}
            </button>
          ))}
        </div>
        <div className="p-2 grid grid-cols-2 gap-2 overflow-y-auto">
          {filteredByCategory.map((f) => (
            <FilterCard
              key={f.id}
              filter={f}
              isActive={selectedFilterId === f.id}
              onClick={() => handleSelectFilter(f)}
            />
          ))}
        </div>
      </div>

      {/* Center - before/after canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-900 relative">
        {/* Photo navigator */}
        {state.capturedPhotos.length > 1 && (
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))} disabled={photoIndex === 0} className="p-1 rounded bg-gray-700 text-white disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="text-white text-sm">{photoIndex + 1} / {state.capturedPhotos.length}</span>
            <button onClick={() => setPhotoIndex(Math.min(state.capturedPhotos.length - 1, photoIndex + 1))} disabled={photoIndex === state.capturedPhotos.length - 1} className="p-1 rounded bg-gray-700 text-white disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        )}

        <div
          ref={containerRef}
          className="relative max-w-xl w-full select-none cursor-col-resize"
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          {/* Original */}
          {originalImage && (
            <img
              src={`data:image/png;base64,${originalImage}`}
              alt="Original"
              className="w-full rounded-xl block"
            />
          )}
          {/* Filtered overlay */}
          {filteredImage && (
            <div
              className="absolute top-0 left-0 h-full overflow-hidden rounded-xl"
              style={{ width: `${dividerX * 100}%` }}
            >
              <img
                src={`data:image/png;base64,${filteredImage}`}
                alt="Filtered"
                className="w-full h-full object-cover rounded-xl"
                style={{ width: `${100 / dividerX}%`, maxWidth: "none" }}
              />
            </div>
          )}
          {/* Divider handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize flex items-center justify-center"
            style={{ left: `calc(${dividerX * 100}% - 2px)` }}
            onMouseDown={() => setDragging(true)}
          >
            <div className="w-6 h-6 bg-white rounded-full shadow flex items-center justify-center">
              <GripVertical size={12} className="text-gray-400" />
            </div>
          </div>
          {/* Labels */}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">Filtered</div>
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">Original</div>
          {/* Loading spinner */}
          {loading && (
            <div className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5">
              <Loader size={14} className="text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setSelectedFilterId(null); setFilteredImage(originalImage); setFilterChain([]); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 text-white rounded-xl text-sm hover:bg-gray-600"
          >
            <RotateCcw size={14} /> Reset
          </button>
          {selectedFilterId && (
            <button
              onClick={handleAddToChain}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm hover:bg-rose-700 transition-colors font-medium"
            >
              + Tambah ke Chain
            </button>
          )}
          <button
            onClick={handleApplyAll}
            disabled={filterChain.length === 0 || loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            Terapkan ke Semua Foto
          </button>
          <button
            onClick={() => { dispatch({ type: "SET_ACTIVE_FILTERS", payload: filterChain }); navigate("/photostrip"); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700"
          >
            Lanjut ke Photostrip <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right sidebar - params + chain + analysis */}
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
        {/* Parameter panel */}
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {selectedFilter ? selectedFilter.name : "Parameter"}
          </p>
          {selectedFilter && selectedFilter.params.length > 0 ? (
            <div className="flex flex-col gap-3">
              {selectedFilter.params.map((param) => (
                <ParameterSlider
                  key={param.name}
                  param={param}
                  value={params[param.name] ?? param.default}
                  onChange={(v) => setParams((prev) => ({ ...prev, [param.name]: v }))}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              {selectedFilter ? "Filter ini tidak memiliki parameter" : "Pilih filter untuk melihat parameter"}
            </p>
          )}
        </div>

        {/* Filter chain */}
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Filter Chain</p>
          {filterChain.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Chain kosong — tambahkan filter</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filterChain.map((f) => (
                <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                  <GripVertical size={12} className="text-gray-400" />
                  <span className="flex-1 text-xs font-medium text-gray-700 truncate">{f.filterType}</span>
                  <button onClick={() => handleRemoveChain(f.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        <div className="p-3">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"
          >
            Analisis {showAnalysis ? "▲" : "▼"}
          </button>
          {showAnalysis && (
            <div className="flex flex-col gap-3">
              {histData && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Histogram (Filtered)</p>
                  <div className="flex items-end gap-px h-16 bg-gray-50 rounded px-1">
                    {histData.filtered.filter((_, i) => i % 4 === 0).map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-rose-400 rounded-sm"
                        style={{ height: `${(v / Math.max(...histData.filtered)) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {spectrumImage && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Spectrum Fourier 2D</p>
                  <img
                    src={`data:image/png;base64,${spectrumImage}`}
                    alt="Spectrum"
                    className="w-full rounded"
                  />
                </div>
              )}
              {!histData && !spectrumImage && (
                <p className="text-xs text-gray-400 italic">Pilih filter untuk melihat analisis</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
