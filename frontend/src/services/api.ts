import type { FilterApiResponse, AnalysisResponse } from "../types";

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
  const response = await fetch(`${API_URL}/api/filter/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image,
      filter_type: filterType,
      params,
      return_analysis: returnAnalysis,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.statusText}`);
  return response.json();
};

export const applyFilterChain = async (
  image: string,
  filters: FilterItem[],
  returnAnalysis = false
): Promise<FilterApiResponse> => {
  const response = await fetch(`${API_URL}/api/filter/chain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, filters, return_analysis: returnAnalysis }),
  });
  if (!response.ok) throw new Error(`API error: ${response.statusText}`);
  return response.json();
};

export const getAnalysis = async (image: string): Promise<AnalysisResponse> => {
  const response = await fetch(`${API_URL}/api/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!response.ok) throw new Error(`API error: ${response.statusText}`);
  return response.json();
};
