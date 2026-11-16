import type { FilterParam } from "../types";

interface ParameterSliderProps {
  param: FilterParam;
  value: number | string | undefined;
  onChange: (val: number | string) => void;
}

export default function ParameterSlider({ param, value, onChange }: ParameterSliderProps) {
  const currentVal = value !== undefined ? value : param.default;

  if (param.type === "select" && param.options) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">{param.label}</label>
        <select
          value={String(currentVal)}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-800 focus:outline-none focus:border-rose-600"
        >
          {param.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (param.type === "color") {
    return (
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">{param.label}</label>
        <input
          type="color"
          value={String(currentVal)}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
        />
      </div>
    );
  }

  const min = param.min ?? 0;
  const max = param.max ?? 100;
  const step = param.step ?? 1;
  const numVal = typeof currentVal === "number" ? currentVal : Number(currentVal) || min;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-gray-700">{param.label}</label>
        <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
          {Number(numVal).toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numVal}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
      />
    </div>
  );
}
