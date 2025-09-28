// Formates the raw data into consistant text strings
// Checks if value is a finite number
export const isNum = (value) => Number.isFinite(value);

// Converts to number or null if invalid
export const toNum = (value) => (Number.isFinite(+value) ? +value : null);

// Clamps value between min and max to never go under 0% or more thatn 100%
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Returns "N/A" if null/empty, else the value
export const show = (value) => (value == null || value === "" ? "N/A" : value);

// Formats seconds to mm:ss.mmm
export const time = (s) => {
  if (!isNum(s) || s < 0) return "N/A";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

// Formats signed seconds (+/-) with 3 decimals
export const sgn = (value) => (isNum(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(3)} s` : "N/A");

// Formats percentage with d decimals
export const pct = (value, d = 1) => (isNum(value) ? `${value.toFixed(d)}%` : "N/A");
