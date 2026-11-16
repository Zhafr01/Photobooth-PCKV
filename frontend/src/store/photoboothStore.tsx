import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import type { FilterChain, GalleryItem, PhotostripLayout, FrameStyle, Sticker } from "../types";

export interface PhotoboothState {
  capturedPhotos: string[];
  filteredPhotos: string[];
  currentPhotoIndex: number;
  activeFilters: FilterChain[];
  photostripLayout: PhotostripLayout;
  photostripFrame: FrameStyle;
  photostripStickers: Sticker[];
  captionText: string;
  sessionGallery: GalleryItem[];
  photostripResult: string | null;
  sessionVideoUrl: string | null;
  sessionGifResult: string | null;
  photoZoom: number;
  photoOffsetX: number;
  photoOffsetY: number;
}

type Action =
  | { type: "ADD_PHOTO"; payload: string }
  | { type: "SET_CAPTURED_PHOTOS"; payload: string[] }
  | { type: "SET_FILTERED_PHOTO"; index: number; payload: string }
  | { type: "SET_FILTERED_PHOTOS"; payload: string[] }
  | { type: "SET_CURRENT_INDEX"; payload: number }
  | { type: "SET_ACTIVE_FILTERS"; payload: FilterChain[] }
  | { type: "ADD_FILTER"; payload: FilterChain }
  | { type: "REMOVE_FILTER"; payload: string }
  | { type: "SET_LAYOUT"; payload: PhotostripLayout }
  | { type: "SET_FRAME"; payload: Partial<FrameStyle> }
  | { type: "SET_STICKERS"; payload: Sticker[] }
  | { type: "ADD_STICKER"; payload: Sticker }
  | { type: "SET_CAPTION"; payload: string }
  | { type: "ADD_GALLERY_ITEM"; payload: GalleryItem }
  | { type: "REMOVE_GALLERY_ITEM"; payload: string }
  | { type: "SET_PHOTOSTRIP_RESULT"; payload: string | null }
  | { type: "SET_SESSION_VIDEO"; payload: string | null }
  | { type: "SET_SESSION_GIF"; payload: string | null }
  | { type: "SET_PHOTO_ADJUSTMENT"; payload: { zoom?: number; offsetX?: number; offsetY?: number } }
  | { type: "RESET" };

const initialState: PhotoboothState = {
  capturedPhotos: [],
  filteredPhotos: [],
  currentPhotoIndex: 0,
  activeFilters: [],
  photostripLayout: "strip4",
  photostripFrame: { color: "#FFFFFF", borderRadius: 8, borderWidth: 16 },
  photostripStickers: [],
  captionText: "",
  sessionGallery: [],
  photostripResult: null,
  sessionVideoUrl: null,
  sessionGifResult: null,
  photoZoom: 1,
  photoOffsetX: 0,
  photoOffsetY: 0,
};

function reducer(state: PhotoboothState, action: Action): PhotoboothState {
  switch (action.type) {
    case "ADD_PHOTO":
      return {
        ...state,
        capturedPhotos: [...state.capturedPhotos, action.payload],
        filteredPhotos: [...state.filteredPhotos, action.payload],
      };
    case "SET_CAPTURED_PHOTOS":
      return { ...state, capturedPhotos: action.payload, filteredPhotos: action.payload };
    case "SET_FILTERED_PHOTO": {
      const updated = [...state.filteredPhotos];
      updated[action.index] = action.payload;
      return { ...state, filteredPhotos: updated };
    }
    case "SET_FILTERED_PHOTOS":
      return { ...state, filteredPhotos: action.payload };
    case "SET_CURRENT_INDEX":
      return { ...state, currentPhotoIndex: action.payload };
    case "SET_ACTIVE_FILTERS":
      return { ...state, activeFilters: action.payload };
    case "ADD_FILTER":
      return { ...state, activeFilters: [...state.activeFilters, action.payload] };
    case "REMOVE_FILTER":
      return { ...state, activeFilters: state.activeFilters.filter((f) => f.id !== action.payload) };
    case "SET_LAYOUT":
      return { ...state, photostripLayout: action.payload };
    case "SET_FRAME":
      return { ...state, photostripFrame: { ...state.photostripFrame, ...action.payload } };
    case "SET_STICKERS":
      return { ...state, photostripStickers: action.payload };
    case "ADD_STICKER":
      return { ...state, photostripStickers: [...state.photostripStickers, action.payload] };
    case "SET_CAPTION":
      return { ...state, captionText: action.payload };
    case "ADD_GALLERY_ITEM":
      return { ...state, sessionGallery: [action.payload, ...state.sessionGallery] };
    case "REMOVE_GALLERY_ITEM":
      return { ...state, sessionGallery: state.sessionGallery.filter((g) => g.id !== action.payload) };
    case "SET_PHOTOSTRIP_RESULT":
      return { ...state, photostripResult: action.payload };
    case "SET_SESSION_VIDEO":
      return { ...state, sessionVideoUrl: action.payload };
    case "SET_SESSION_GIF":
      return { ...state, sessionGifResult: action.payload };
    case "SET_PHOTO_ADJUSTMENT":
      return {
        ...state,
        photoZoom: action.payload.zoom ?? state.photoZoom,
        photoOffsetX: action.payload.offsetX ?? state.photoOffsetX,
        photoOffsetY: action.payload.offsetY ?? state.photoOffsetY,
      };
    case "RESET":
      return { ...initialState, sessionGallery: state.sessionGallery };
    default:
      return state;
  }
}

const PhotoboothContext = createContext<{
  state: PhotoboothState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const PhotoboothProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <PhotoboothContext.Provider value={{ state, dispatch }}>
      {children}
    </PhotoboothContext.Provider>
  );
};

export const usePhotobooth = () => {
  const ctx = useContext(PhotoboothContext);
  if (!ctx) throw new Error("usePhotobooth must be used within PhotoboothProvider");
  return ctx;
};
