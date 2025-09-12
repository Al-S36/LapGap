import { timeFormatter, gapFormatter, gapClass } from "./services/timeFormatter";


// Responsible for the Statistics bar, formates the times of the lap times
// as well as calculates the live delta and final gap between laps

export default function StatsStrip({ lapTimeA, lapTimeB, liveDelta }) {
  // Calculates the final gap between two laps
  const finalGap = (lapTimeB || 0) - (lapTimeA || 0);

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
    </div>
  );
}
