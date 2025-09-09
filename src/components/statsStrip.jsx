// Responsible for the Statistics bar, formates the times of the lap times
// as well as calculates the live delta and final gap between laps

export default function StatsStrip({ lapTimeA, lapTimeB, liveDelta }) {
  // Time formater, takes the lap time and formats it in mm:ss:mmm
  const timeFormatter = (lapTime) => {
    if (!lapTime || lapTime < 0) lapTime = 0;
    const minutes = Math.floor(lapTime / 60);
    const seconds = Math.floor(lapTime % 60);
    const milliseconds = Math.floor((lapTime - Math.floor(lapTime)) * 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}.${String(milliseconds).padStart(3, "0")}`;
  };

  // Calculates the final gap between two laps
  const finalGap = (lapTimeB || 0) - (lapTimeA || 0);
  // Formats the gap to be s.mm no matter if positive or negative
  const formatGap = (n) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

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
        <div className={`stat-value ${liveDelta >= 0 ? "warning" : "success"}`}>
          {formatGap(liveDelta)} seconds
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Final Gap</div>
        <div className={`stat-value ${finalGap >= 0 ? "warning" : "success"}`}>
          {formatGap(finalGap)} seconds
        </div>
      </div>
    </div>
  );
}
