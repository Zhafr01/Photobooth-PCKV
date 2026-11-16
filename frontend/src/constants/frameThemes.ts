export interface FrameTheme {
  id: string;
  name: string;
  category: "klasik" | "pastel" | "gradient" | "vintage" | "pattern";
  type: "solid" | "gradient" | "pattern" | "film";
  color: string;
  gradient?: [string, string];
  pattern?: "polka" | "checker" | "grid" | "hearts";
  textColor?: string;
  borderColor?: string;
  hasDoubleBorder?: boolean;
}

export const FRAME_THEMES: FrameTheme[] = [
  // ── Klasik & Studio ──
  { id: "white", name: "Putih Studio", category: "klasik", type: "solid", color: "#FFFFFF", textColor: "#1A1A1A" },
  { id: "black", name: "Hitam Editorial", category: "klasik", type: "solid", color: "#18181B", textColor: "#FFFFFF" },
  { id: "ivory", name: "Warm Ivory", category: "klasik", type: "solid", color: "#FAF7F2", textColor: "#292524" },
  { id: "slate", name: "Slate Minimalist", category: "klasik", type: "solid", color: "#334155", textColor: "#F8FAFC" },
  { id: "espresso", name: "Espresso Dark", category: "klasik", type: "solid", color: "#271E18", textColor: "#F5EBE0" },

  // ── Pastel & Aesthetic ──
  { id: "sakura", name: "Sakura Pink", category: "pastel", type: "solid", color: "#FCE7F3", textColor: "#831843", borderColor: "#F472B6" },
  { id: "lavender", name: "Lavender Dream", category: "pastel", type: "solid", color: "#EDE9FE", textColor: "#4C1D95", borderColor: "#C4B5FD" },
  { id: "matcha", name: "Matcha Mint", category: "pastel", type: "solid", color: "#DCFCE7", textColor: "#14532D", borderColor: "#86EFAC" },
  { id: "butter", name: "Butter Yellow", category: "pastel", type: "solid", color: "#FEF9C3", textColor: "#713F12", borderColor: "#FDE047" },
  { id: "sky", name: "Baby Sky Blue", category: "pastel", type: "solid", color: "#E0F2FE", textColor: "#0C4A6E", borderColor: "#7DD3FC" },
  { id: "peach", name: "Soft Peach", category: "pastel", type: "solid", color: "#FFEDD5", textColor: "#7C2D12", borderColor: "#FDBA74" },

  // ── Gradient Aesthetic ──
  { id: "sunset", name: "Sunset Horizon", category: "gradient", type: "gradient", color: "#FF5E62", gradient: ["#FF5E62", "#FF9966"], textColor: "#FFFFFF" },
  { id: "neon", name: "Neon Cyberpunk", category: "gradient", type: "gradient", color: "#8A2387", gradient: ["#8A2387", "#E94057"], textColor: "#FFFFFF" },
  { id: "cotton", name: "Cotton Candy", category: "gradient", type: "gradient", color: "#F472B6", gradient: ["#F472B6", "#A78BFA"], textColor: "#FFFFFF" },
  { id: "ocean", name: "Ocean Breeze", category: "gradient", type: "gradient", color: "#00b4db", gradient: ["#00b4db", "#0083b0"], textColor: "#FFFFFF" },
  { id: "midnight", name: "Midnight Aurora", category: "gradient", type: "gradient", color: "#0f172a", gradient: ["#0f172a", "#1e293b"], textColor: "#E2E8F0" },
  { id: "emerald", name: "Emerald Forest", category: "gradient", type: "gradient", color: "#064e3b", gradient: ["#064e3b", "#059669"], textColor: "#ECFDF5" },

  // ── Retro & Vintage ──
  { id: "polaroid", name: "90s Polaroid", category: "vintage", type: "solid", color: "#F7F3E9", textColor: "#3D3935", hasDoubleBorder: true },
  { id: "filmstrip", name: "35mm Film Strip", category: "vintage", type: "film", color: "#141414", textColor: "#FAFAFA" },
  { id: "parchment", name: "Vintage Parchment", category: "vintage", type: "solid", color: "#EFE0CD", textColor: "#452A0A", borderColor: "#D5BE9E" },
  { id: "terracotta", name: "70s Terracotta", category: "vintage", type: "solid", color: "#C85A32", textColor: "#FFF7ED" },

  // ── Pattern & Fun ──
  { id: "polka", name: "Polka Dots Cute", category: "pattern", type: "pattern", pattern: "polka", color: "#FDF2F8", borderColor: "#F472B6", textColor: "#831843" },
  { id: "checker", name: "Y2K Checkerboard", category: "pattern", type: "pattern", pattern: "checker", color: "#18181B", borderColor: "#3F3F46", textColor: "#FFFFFF" },
  { id: "grid", name: "Notebook Grid", category: "pattern", type: "pattern", pattern: "grid", color: "#F8FAFC", borderColor: "#CBD5E1", textColor: "#0F172A" },
  { id: "hearts", name: "Sweet Hearts", category: "pattern", type: "pattern", pattern: "hearts", color: "#FFF1F2", borderColor: "#FB7185", textColor: "#9F1239" },
];

export interface StickerCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: "cute",
    name: "Cute & Kawaii",
    icon: "🎀",
    emojis: ["🎀", "🧸", "🐰", "🐱", "🌸", "🍓", "🍰", "🍭", "🍡", "🧁", "🌷", "🩰", "🪞", "🐾", "🍼", "🍮", "🐣", "🧋", "🍒", "🍯"],
  },
  {
    id: "y2k",
    name: "Y2K & Aesthetic",
    icon: "✨",
    emojis: ["⭐", "✨", "💫", "🦋", "💖", "💿", "🍒", "💅", "⚡", "🪐", "🔮", "🫧", "🪩", "🕶️", "🎧", "🔥", "🖤", "🗝️", "🧿", "💎"],
  },
  {
    id: "love",
    name: "Love & Romance",
    icon: "💌",
    emojis: ["💌", "💘", "💝", "💕", "🌹", "💍", "💋", "🕊️", "💐", "🥂", "🕯️", "❤️‍🔥", "🫶", "🫰", "🤍", "😘", "🫀", "🏹", "💞", "🥰"],
  },
  {
    id: "party",
    name: "Party & Hype",
    icon: "🎉",
    emojis: ["🎉", "🥳", "🎂", "🎈", "🎊", "🍾", "👑", "🎁", "🎇", "🎆", "🎵", "🕺", "💃", "🍻", "🏆", "🪅", "🍿", "🎤", "🎷", "🎸"],
  },
  {
    id: "retro",
    name: "Retro & Fun",
    icon: "👾",
    emojis: ["👾", "🕹️", "📼", "🛹", "🍕", "🍟", "🥤", "🥑", "🌈", "🌻", "✌️", "🤪", "😎", "👀", "🤡", "🚀", "🍄", "🍦", "🍩", "📷"],
  },
  {
    id: "doodle",
    name: "Doodles & Chat",
    icon: "💬",
    emojis: ["💬", "🗯️", "💭", "💯", "✔️", "❌", "❓", "❗️", "⚡️", "💢", "💤", "🎶", "📸", "🎬", "🌟", "🏷️", "📌", "✂️", "🪄", "💡"],
  },
];

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: "Script" | "Serif" | "Sans" | "Retro" | "Display";
}

export const FONT_OPTIONS: FontOption[] = [
  // Script / Handwriting
  { id: "dancing", name: "Dancing Script", family: "'Dancing Script', cursive", category: "Script" },
  { id: "pacifico", name: "Pacifico", family: "'Pacifico', cursive", category: "Script" },
  { id: "caveat", name: "Caveat Doodle", family: "'Caveat', cursive", category: "Script" },

  // Serif
  { id: "playfair", name: "Playfair Display", family: "'Playfair Display', Georgia, serif", category: "Serif" },
  { id: "cinzel", name: "Cinzel Royal", family: "'Cinzel', Georgia, serif", category: "Serif" },
  { id: "georgia", name: "Georgia Klasik", family: "Georgia, serif", category: "Serif" },

  // Sans-serif
  { id: "inter", name: "Inter Modern", family: "'Inter', sans-serif", category: "Sans" },
  { id: "montserrat", name: "Montserrat Clean", family: "'Montserrat', sans-serif", category: "Sans" },
  { id: "courier", name: "Typewriter / Mono", family: "'Courier Prime', monospace", category: "Sans" },

  // Retro / Cute
  { id: "shrikhand", name: "Shrikhand 70s", family: "'Shrikhand', cursive", category: "Retro" },
  { id: "righteous", name: "Righteous Deco", family: "'Righteous', cursive", category: "Retro" },
  { id: "lobster", name: "Lobster Retro", family: "'Lobster', cursive", category: "Retro" },

  // Display / Bold
  { id: "impact", name: "Impact Bold", family: "Impact, sans-serif", category: "Display" },
  { id: "arialblack", name: "Arial Black Heavy", family: "'Arial Black', sans-serif", category: "Display" },
];

