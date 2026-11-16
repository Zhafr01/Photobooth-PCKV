import type { FilterApiResponse, AnalysisResponse } from "../types";
import { applyClientFilter } from "./clientFilters";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface FilterItem {
  type: string;
  params: Record<string, number | string>;
}

export const applyFilter = async (
  image: string,
  filterType: string,
  params: Record<string, number | string>,
  returnAnalysis = false
): Promise<FilterApiResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

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
    // Backend offline / mixed-content fallback
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
    const timeoutId = setTimeout(() => controller.abort(), 3000);

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
    const timeoutId = setTimeout(() => controller.abort(), 2500);

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
