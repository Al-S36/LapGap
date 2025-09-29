import { useMemo } from "react";
import { timeFormatter } from "./services/timeFormatter";

export default function TimeScrubber({
  durationA = 0,
  durationB = 0,
  value = 0,
  onSeek,
  onSeekStart,
  onSeekEnd,
  anchors = [],
  highlightAt = null,
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

  // Clamp anchor times to [0, maxDuration] (in seconds)
  const clampedAnchorTimes = useMemo(() => {
    if (!Number.isFinite(maxDuration) || maxDuration <= 0) return [];
    return (anchors || [])
      .map((anchorSec) =>
        Number.isFinite(anchorSec)
          ? Math.min(Math.max(anchorSec, 0), maxDuration)
          : null
      )
      .filter((anchorSec) => anchorSec !== null);
  }, [anchors, maxDuration]);

  // Index of the anchor closest to the highlight time (if provided)
  const nearestAnchorIndex = useMemo(() => {
    if (!Number.isFinite(highlightAt) || clampedAnchorTimes.length === 0)
      return -1;
    let closestIdx = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < clampedAnchorTimes.length; i++) {
      const distance = Math.abs(clampedAnchorTimes[i] - highlightAt);
      if (distance < bestDistance) {
        bestDistance = distance;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [highlightAt, clampedAnchorTimes]);

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="t-now">{timeFormatter(safeVal)}</span>
        <span className="t-max">{timeFormatter(maxDuration)}</span>
      </div>

      <div className="timeline-track">
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

        {/* Markers overlay */}
        <div className="timeline-markers" aria-hidden>
          {normAnchors.map((t, i) => {
            const pct = (t / (maxDuration || 1)) * 100;
            const isActive = i === nearestAnchorIndex;
            return (
              <span
                key={`${i}-${t}`}
                className={`timeline-marker${isActive ? " active" : ""}`}
                style={{ left: `${pct}%` }}
                title={timeFormatter(t)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
