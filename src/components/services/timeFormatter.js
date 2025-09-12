// Time formatter, takes the lap time and formats it in mm:ss:ms
export const timeFormatter = (lapTime) => {
  let time = Number.isFinite(lapTime) ? lapTime : 0;
  if (time < 0) time = 0;

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}.${String(milliseconds).padStart(3, "0")}`;
};

// Formats the gap to be s.mm no matter if positive or negative
export const gapFormatter = (gap) => {
  if (!Number.isFinite(gap)) return "0.000";
  if (gap === 0) return "0.000";
  return gap > 0 ? `+${gap.toFixed(3)}` : gap.toFixed(3);
};

// Returns a class based on gap delta
export const gapClass = (gap) => {
  if (!Number.isFinite(gap) || gap === 0) return "";
  return gap > 0 ? "warning" : "success";
};
