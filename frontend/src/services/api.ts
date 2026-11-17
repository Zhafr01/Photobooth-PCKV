import type { FilterApiResponse, AnalysisResponse } from "../types";
import { applyClientFilter } from "./clientFilters";

export const DEFAULT_BACKEND_URL = "https://photobooth-pckv-backend.onrender.com";

export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, "");
  }
  // In production (e.g. GitHub Pages) or any non-localhost host, always use the public Render backend
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return DEFAULT_BACKEND_URL;
  }
  return "http://localhost:8000";
}

const API_URL = getApiUrl();

// Render free tier cold-starts in ~15-30s. We use longer timeout for chain (heavy) vs single filter.
const TIMEOUT_SINGLE = 30000;  // 30s
const TIMEOUT_CHAIN  = 60000;  // 60s

export interface FilterItem {
  type: string;
  params: Record<string, number | string>;
}

/** Ping /health — returns true if backend is alive, false if cold/offline */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
};

export const applyFilter = async (
  image: string,
  filterType: string,
  params: Record<string, number | string>,
  returnAnalysis = false
): Promise<FilterApiResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SINGLE);

    const response = await fetch(`${API_URL}/api/filter/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        filter_type: filterType,
        params,
        return_analysis: returnAnalysis,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Backend offline / cold-start timeout → fallback to client-side
  }

  // Pure Client-side mathematical filter engine (Gonzalez & Woods)
  return applyClientFilter(image, filterType, params, returnAnalysis);
};

export const applyFilterChain = async (
  image: string,
  filters: FilterItem[],
  returnAnalysis = false
): Promise<FilterApiResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CHAIN);

    const response = await fetch(`${API_URL}/api/filter/chain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, filters, return_analysis: returnAnalysis }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Backend offline fallback
  }

  // Client-side sequential chain
  let lastResult: FilterApiResponse = {
    status: "ok",
    result_image: image,
    execution_time_ms: 0,
    spectrum_image: null,
    histogram_data: {
      original: [],
      filtered: [],
    },
  };

  let currentImage = image;
  for (const f of filters) {
    lastResult = await applyClientFilter(currentImage, f.type, f.params, returnAnalysis);
    currentImage = lastResult.result_image;
  }

  return lastResult;
};

export const getAnalysis = async (image: string): Promise<AnalysisResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SINGLE);

    const response = await fetch(`${API_URL}/api/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Backend offline fallback
  }

  const clientRes = await applyClientFilter(image, "film_negative", {}, true);
  return {
    histogram: clientRes.histogram_data.original,
    spectrum_image: clientRes.spectrum_image || "",
  };
};
