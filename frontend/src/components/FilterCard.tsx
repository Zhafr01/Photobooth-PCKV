import type { FilterDefinition } from "../types";

interface FilterCardProps {
  filter: FilterDefinition;
  isActive: boolean;
  onClick: () => void;
}

const categoryColors: Record<string, string> = {
  tone: "bg-orange-50 text-orange-700 border-orange-200",
  frequency: "bg-blue-50 text-blue-700 border-blue-200",
  artistic: "bg-purple-50 text-purple-700 border-purple-200",
  spatial: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function FilterCard({ filter, isActive, onClick }: FilterCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl overflow-hidden border-2 transition-all duration-150 ${
        isActive
          ? "border-rose-600 bg-rose-50/50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs"
      }`}
    >
      {/* Clean Solid Swatch instead of gradient */}
      <div
        className="h-10 w-full flex items-center justify-center font-mono text-[11px] font-semibold text-white/90 tracking-wider"
        style={{ backgroundColor: filter.gradientFrom || "#374151" }}
      >
        {filter.categoryLabel.toUpperCase()}
      </div>
      <div className="p-2.5">
        <p className={`text-xs font-bold truncate ${isActive ? "text-rose-700" : "text-gray-900"}`}>
          {filter.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              categoryColors[filter.category] || "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {filter.categoryLabel}
          </span>
          <span className="text-[10px] text-gray-400">
            {filter.params.length > 0 ? `${filter.params.length} param` : "Preset"}
          </span>
        </div>
      </div>
    </button>
  );
}
