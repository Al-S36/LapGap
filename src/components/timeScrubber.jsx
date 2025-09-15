import { useMemo } from "react";
import { timeFormatter } from "./services/timeFormatter";

export default function TimeScrubber({
  durationA = 0,
  durationB = 0,
  value = 0,
  onSeek,
  onSeekStart,
  onSeekEnd,
}) {
  // Calculates the max duration of the scrubber accoridng to whichever video is longer
  const maxDuration = useMemo(
    () => Math.max(durationA || 0, durationB || 0),
    [durationA, durationB]
  );

  // Get the current value between 0 and the max duration
  const safeVal = Math.min(Math.max(value || 0, 0), maxDuration || 0);
  // Disable until we have a valid duration
  const disabled = !Number.isFinite(maxDuration) || maxDuration <= 0;

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="t-now">{timeFormatter(safeVal)}</span>
        <span className="t-max">{timeFormatter(maxDuration)}</span>
      </div>

      <input
        className="timeline-range"
        type="range"
        min={0}
        max={maxDuration || 0}
        // 10ms steps
        step={0.01}
        value={safeVal}
        onChange={(e) => onSeek?.(Number(e.target.value) || 0)}
        onPointerDown={onSeekStart}
        onPointerUp={onSeekEnd}
        disabled={disabled}
        aria-label="Global scrubber (controls both videos)"
      />
    </div>
  );
}
