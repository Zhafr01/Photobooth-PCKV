import { motion } from "framer-motion";
import { useState } from "react";

interface FilterDoc {
  id: string;
  name: string;
  chapter: string;
  chapterNum: number;
  category: string;
  formula: React.ReactNode;
  description: string;
  badgeColor: string;
}

const filters: FilterDoc[] = [
  {
    id: "film_negative", name: "Film Negatif", chapter: "Bab 3", chapterNum: 3,
    category: "Transformasi Intensitas", badgeColor: "bg-red-100 text-red-600",
    formula: <span><em>s</em> = <em>L</em> − 1 − <em>r</em></span>,
    description: "Setiap nilai intensitas piksel r dibalik terhadap nilai maksimum L−1=255. Piksel putih menjadi hitam dan sebaliknya, menghasilkan efek film negatif analog. Filter ini diterapkan langsung pada ketiga kanal R, G, B.",
  },
  {
    id: "shadow_lift", name: "Shadow Lift (Log Transform)", chapter: "Bab 3", chapterNum: 3,
    category: "Transformasi Intensitas", badgeColor: "bg-red-100 text-red-600",
    formula: <span><em>s</em> = <em>c</em> · log(1 + <em>r</em>), &nbsp;<em>c</em> = 255 / log(256)</span>,
    description: "Transformasi logaritma memperluas rentang intensitas rendah (area gelap/bayangan) dan memampatkan rentang tinggi (area terang). Sangat berguna untuk foto yang diambil di tempat kurang cahaya karena detail di bayangan menjadi terlihat. Diterapkan pada kanal luminans Y.",
  },
  {
    id: "gamma_transform", name: "Bright / Moody (Koreksi Gamma)", chapter: "Bab 3", chapterNum: 3,
    category: "Transformasi Intensitas", badgeColor: "bg-red-100 text-red-600",
    formula: <span><em>s</em> = <em>c</em> · <em>r</em><sup>γ</sup></span>,
    description: "Power-law transformation. Nilai γ < 1 memperluas rentang gelap (efek cerah/bright), sedangkan γ > 1 memampatkan rentang gelap sehingga foto tampak lebih gelap (efek moody). Parameter c dinormalisasi agar hasil tetap dalam [0,255].",
  },
  {
    id: "histogram_equalization", name: "Auto Enhance (Ekualisasi Histogram)", chapter: "Bab 3", chapterNum: 3,
    category: "Transformasi Intensitas", badgeColor: "bg-red-100 text-red-600",
    formula: <span><em>s</em> = (<em>L</em>−1) · CDF(<em>r</em>) = (<em>L</em>−1) · Σ <em>p</em>(<em>r</em><sub>j</sub>)</span>,
    description: "Histogram equalization meratakan distribusi intensitas piksel secara otomatis dengan memetakan setiap nilai intensitas r menggunakan Cumulative Distribution Function (CDF) dari histogram. Hasilnya, histogram yang awalnya terkonsentrasi di satu rentang tersebar merata, meningkatkan kontras global.",
  },
  {
    id: "dreamy_soft", name: "Dreamy Soft (Gaussian LPF)", chapter: "Bab 4", chapterNum: 4,
    category: "Filtering Domain Frekuensi", badgeColor: "bg-blue-100 text-blue-600",
    formula: <span><em>H</em>(<em>u</em>,<em>v</em>) = exp(−<em>D</em>²(<em>u</em>,<em>v</em>) / 2<em>D</em><sub>0</sub>²)</span>,
    description: "Filter domain frekuensi yang meloloskan komponen frekuensi rendah (detail besar, warna dasar) dan meredam frekuensi tinggi (tepi, detail halus). Berbeda dengan ILPF, transisi Gaussian tidak menimbulkan efek ringing (Gibbs phenomenon) sehingga hasilnya halus dan natural. Diproses via FFT 2D.",
  },
  {
    id: "ghost_glitch", name: "Ghost / Cyber Glitch (Ideal LPF)", chapter: "Bab 4", chapterNum: 4,
    category: "Filtering Domain Frekuensi", badgeColor: "bg-blue-100 text-blue-600",
    formula: <span><em>H</em>(<em>u</em>,<em>v</em>) = 1 jika <em>D</em> ≤ <em>D</em><sub>0</sub>, lainnya 0</span>,
    description: "Ideal Low-Pass Filter memotong frekuensi secara diskrit pada radius D₀. Pemotongan mendadak ini menyebabkan fenomena Gibbs (ringing): gelombang-gelombang melingkar di sekitar tepi gambar. Pada filter Cyber Glitch, efek ringing ini sengaja dimanfaatkan sebagai efek artistik hologram/glitch.",
  },
  {
    id: "detail_pop", name: "Detail Pop (High-Boost Filtering)", chapter: "Bab 4", chapterNum: 4,
    category: "Filtering Domain Frekuensi", badgeColor: "bg-blue-100 text-blue-600",
    formula: <span><em>H</em> = <em>k</em><sub>1</sub> + <em>k</em><sub>2</sub> · <em>H</em><sub>hp</sub>, &nbsp; <em>H</em><sub>hp</sub> = 1 − <em>H</em><sub>lp</sub></span>,
    description: "High-boost filter mempertahankan sinyal asli (k₁ × original) sekaligus menambahkan salinan high-pass yang telah diperkuat (k₂ × edges). Hasilnya: foto tetap terlihat natural namun tepi (rambut, tekstur pakaian, bulu mata) tampak sangat menonjol dan 'crisp'.",
  },
  {
    id: "fix_backlight", name: "Fix Backlight (Homomorphic Filtering)", chapter: "Bab 4", chapterNum: 4,
    category: "Filtering Domain Frekuensi", badgeColor: "bg-blue-100 text-blue-600",
    formula: <span><em>f</em>(<em>x</em>,<em>y</em>) = <em>i</em>(<em>x</em>,<em>y</em>) · <em>r</em>(<em>x</em>,<em>y</em>)</span>,
    description: "Model pembentukan citra (Bab 2) memodelkan citra sebagai hasil kali iluminasi i (pencahayaan dari sumber cahaya, frekuensi rendah) dan reflektansi r (sifat permukaan objek, frekuensi tinggi). Dengan transformasi ln, perkalian menjadi penjumlahan sehingga keduanya bisa difilter terpisah di domain frekuensi.",
  },
  {
    id: "vignette", name: "Vignette Effect (Perkalian Citra)", chapter: "Bab 2", chapterNum: 2,
    category: "Operasi Aritmatika", badgeColor: "bg-green-100 text-green-600",
    formula: <span><em>g</em>(<em>x</em>,<em>y</em>) = <em>f</em>(<em>x</em>,<em>y</em>) · <em>M</em>(<em>x</em>,<em>y</em>)</span>,
    description: "Operasi perkalian citra dengan mask gradien radial M(x,y). Mask M bernilai 1.0 di tengah dan menurun secara Gaussian menuju sudut-sudut (M = exp(-(dx²+dy²)/2σ²)). Hasilnya: sudut foto menggelap secara alami, memusatkan perhatian mata ke subjek di tengah.",
  },
  {
    id: "double_exposure", name: "Double Exposure (Blending Citra)", chapter: "Bab 2", chapterNum: 2,
    category: "Operasi Aritmatika", badgeColor: "bg-green-100 text-green-600",
    formula: <span><em>g</em>(<em>x</em>,<em>y</em>) = α·<em>f</em><sub>1</sub> + (1−α)·<em>f</em><sub>2</sub></span>,
    description: "Penjumlahan linier berbobot (linear blending) antara dua citra. Parameter α mengontrol dominasi masing-masing citra. Jika α=0.5, kedua citra tampil seimbang. Teknik ini digunakan di fotografi profesional untuk efek 'double exposure' artistik.",
  },
  {
    id: "segment_background", name: "Ganti Background (Otsu + Morfologi)", chapter: "Bab 9 & 10", chapterNum: 9,
    category: "Morfologi & Segmentasi", badgeColor: "bg-purple-100 text-purple-600",
    formula: <span>σ²<sub>B</sub>(<em>T</em>) = ω<sub>0</sub>ω<sub>1</sub>(μ<sub>0</sub>−μ<sub>1</sub>)², T* = argmax σ²<sub>B</sub></span>,
    description: "Metode Otsu mencari threshold T secara otomatis dengan memaksimalkan variansi antar-kelas (between-class variance σ²_B). Setelah threshold ditemukan, citra dikonversi ke biner (objek/background). Tepi mask dirapikan menggunakan operasi morfologi Opening (erosi→dilasi) dan Closing (dilasi→erosi) dari Bab 9.",
  },
];

const chapterColors: Record<number, string> = {
  2: "bg-green-100 text-green-700",
  3: "bg-red-100 text-red-700",
  4: "bg-blue-100 text-blue-700",
  9: "bg-purple-100 text-purple-700",
  10: "bg-purple-100 text-purple-700",
};

export default function EducationPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const categories = ["all", "Transformasi Intensitas", "Filtering Domain Frekuensi", "Operasi Aritmatika", "Morfologi & Segmentasi"];

  const filtered = activeCategory === "all" ? filters : filters.filter((f) => f.category === activeCategory);

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
            Behind the Filter
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Setiap filter dibangun dari rumus matematika Gonzalez & Woods — Digital Image Processing
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white border border-gray-300 text-gray-700 hover:border-rose-600"
              }`}
            >
              {cat === "all" ? "Semua Filter" : cat}
            </button>
          ))}
        </div>

        {/* Filter cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl shadow p-5 border border-pink-50 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">{f.name}</h3>
                  <span className="text-xs text-gray-500">{f.category}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${chapterColors[f.chapterNum]}`}>
                  {f.chapter}
                </span>
              </div>

              {/* Formula */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 font-mono text-sm text-gray-700 overflow-x-auto">
                {f.formula}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Reference note */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Referensi: R.C. Gonzalez & R.E. Woods, <em>Digital Image Processing</em>, 3rd Edition. Pearson, 2008.
        </div>
      </div>
    </motion.div>
  );
}
