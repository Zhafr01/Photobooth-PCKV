export type PhotostripLayout = "strip3" | "strip4" | "grid2x2" | "singleCard" | "grid2x2portrait";

export interface FrameStyle {
  color: string;
  themeId?: string;
  borderRadius: number;
  borderWidth: number;
}

export interface Sticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  imageUrl?: string; // base64 data URL for custom uploaded stickers
  rotation?: number; // degrees
}

export interface FilterParam {
  name: string;
  label: string;
  type: "range" | "select" | "color";
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  options?: { value: string; label: string }[];
}

export interface FilterDefinition {
  id: string;
  name: string;
  category: "tone" | "frequency" | "artistic" | "spatial" | "face";
  categoryLabel: string;
  description: string;
  params: FilterParam[];
  gradientFrom: string;
  gradientTo: string;
}

export interface FilterChain {
  id: string;
  filterType: string;
  params: Record<string, number | string>;
}

export interface GalleryItem {
  id: string;
  thumbnail: string; // base64
  fullImage: string; // base64
  createdAt: string;
  filters: FilterChain[];
  itemType?: "strip" | "photo";
}

export interface FilterApiResponse {
  status: string;
  result_image: string;
  spectrum_image: string | null;
  histogram_data: {
    original: number[];
    filtered: number[];
  };
  execution_time_ms: number;
}

export interface AnalysisResponse {
  histogram: number[];
  spectrum_image: string;
}
