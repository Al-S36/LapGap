import { useEffect, useRef, useState } from "react";
import {
  timeFormatter,
  gapFormatter,
  gapClass,
} from "./services/timeFormatter";
import {
  computeLeadPercentA,
  computeConsistencyScore,
  computeTheoreticalBestLapPreferred,
} from "./services/improvementStats";

export default function StatsStrip({
  lapTimeA,
  lapTimeB,
  liveDelta,
  deltaSamples = [],
  anchorPairs = null,
  sessionKey,
}) {
  
  // Calculates the final gap between two laps
  const finalGap = (lapTimeB || 0) - (lapTimeA || 0);

  // Try to use anchors otherwise fall back to delta-based theoretical
  const theoreticalBest = computeTheoreticalBestLapPreferred(
    lapTimeA,
    lapTimeB,
    deltaSamples,
    60,
    anchorPairs
  );

  // Theoretical saving = fastest lap − theoretical best lap
  const fastest = Math.min(Number(lapTimeA) || 0, Number(lapTimeB) || 0);
  const theoreticalSaving = Math.max(
    0,
    fastest - (Number(theoreticalBest) || 0)
  );

  // Consistency metric
  const consistency = computeConsistencyScore(deltaSamples);
  // Lead percetnage metric
  const leadPctA = computeLeadPercentA(deltaSamples);

  // If we have anchors theo best is stable so we show current value
  const hasAnchors = Array.isArray(anchorPairs) && anchorPairs.length >= 2;

  // Monotonic display state used only before anchors exist
  const [savingDisplay, setSavingDisplay] = useState(0);
  const bestSavingSoFarRef = useRef(0);

  // Reset when the compared videos change
  useEffect(() => {
    bestSavingSoFarRef.current = 0;
    setSavingDisplay(0);
  }, [sessionKey]);

  useEffect(() => {
    if (hasAnchors) {
      // Anchors present so we show exact current saving
      bestSavingSoFarRef.current = theoreticalSaving;
      setSavingDisplay(theoreticalSaving);
      return;
    }
    // tolerance for float noise
    const EPS = 0.0005;
    if (theoreticalSaving > bestSavingSoFarRef.current + EPS) {
      bestSavingSoFarRef.current = theoreticalSaving;
      setSavingDisplay(theoreticalSaving);
    }
  }, [theoreticalSaving, hasAnchors]);

  const formatSeconds = (s) => `${(Number.isFinite(s) ? s : 0).toFixed(3)}s`;

  return (
    <div className="stats-container">
      <div className="stat">
        <div className="stat-label">Lap Time A</div>
        <div className="stat-value">{timeFormatter(lapTimeA)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Lap Time B</div>
        <div className="stat-value">{timeFormatter(lapTimeB)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Live Delta (B vs A)</div>
        <div className={`stat-value ${gapClass(liveDelta)}`}>
          {gapFormatter(liveDelta)} seconds
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Final Gap</div>
        <div className={`stat-value ${gapClass(finalGap)}`}>
          {gapFormatter(finalGap)} seconds
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Theoretical Best Lap</div>
        <div className="stat-value">{timeFormatter(theoreticalBest)}</div>
      </div>

      <div className="stat">
        <div className="stat-label">Theoretical Time Saving</div>
        <div className="stat-value">
          {formatSeconds(hasAnchors ? theoreticalSaving : savingDisplay)}
        </div>
      </div>

      <div className="stat">
        <div className="stat-label">Consistency</div>
        <div className="stat-value">{consistency}%</div>
      </div>

      <div className="stat">
        <div className="stat-label">Lead % (A)</div>
        <div className="stat-value">{leadPctA}%</div>
      </div>
    </div>
  );
}
