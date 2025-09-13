import { useEffect, useRef, useState } from "react";
import { gapFormatter, gapClass } from "../components/services/timeFormatter";

// Live delta bar to show the rates of change
// Makes it easier for the user to quickly see how much faster or slower they are going
export default function DeltaCard({
  // total delta time in seconds used by the display
  totalDelta = 0,

  // Rate in Ms used to compute the slope and the smoothing of it
  computeRateMs = 900,
  barRateSmoothing = 0.2,

  // Small rate change handling
  minRateChange = 0.0005,
  miniDeltaRate = 0.0025,
  minShownRate = 0.0015,

  // Mid rate for the mid-bar
  midRate = 0.05,
  // The more the rate the sooner it fills the bar
  saturationGain = 2.0,
  // Boosts small values to make them show on bar, suppresses larger ones to keep them on the bar
  smallRateBooster = 0.6,
  // Minimum length of the half bar wehn not 0
  minFillLen = 0.12,
  // Minimum opacity when not 0
  minFillOpacity = 0.22,
}) {
  // Delta history of [time, totalDelta]
  const deltaHistory = useRef([]);
  //Current window’s span and change in seconds
  const windowDeltaRef = useRef({ secondsSpan: 0, deltaChange: 0 });
  // Slope of delta over the current window
  const [windowRate, setWindowRate] = useState(0);

  useEffect(() => {
    const timeMs = performance.now();

    // Push the latest sample into our rolling history
    const history = deltaHistory.current;
    history.push({ timeMs, delta: totalDelta });

    // Keep only samples within the last computeRateMs milliseconds
    const windowStartMs = timeMs - computeRateMs;
    while (history.length && history[0].timeMs < windowStartMs) {
      history.shift();
    }

    // Compute rate from oldest to newest sample in the window
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];

      const secondsSpan = (newest.timeMs - oldest.timeMs) / 1000;
      const deltaChange = newest.delta - oldest.delta;

      windowDeltaRef.current = { secondsSpan, deltaChange };

      if (secondsSpan > 0) {
        setWindowRate(deltaChange / secondsSpan);
      }
    }
  }, [totalDelta, computeRateMs]);

  const smoothedRateRef = useRef(0);
  const [smoothedRate, setSmoothedRate] = useState(0);

  // Smoothing the live rate so its not jittery
  useEffect(() => {
    const a = Math.max(0.01, Math.min(0.99, barRateSmoothing));
    smoothedRateRef.current =
      (1 - a) * smoothedRateRef.current + a * windowRate;
    setSmoothedRate(smoothedRateRef.current);
  }, [windowRate, barRateSmoothing]);

  // Making sure tiny but real trends still show up 
  let visibleRate = smoothedRate;
  const absVisibleRate = Math.abs(visibleRate);

  // If rate is below the threshold a small visible rate in the correct direction
  if (absVisibleRate < minRateChange) {
    const { secondsSpan, deltaChange } = windowDeltaRef.current;
    const absDeltaChange = Math.abs(deltaChange);

    if (secondsSpan > 0 && absDeltaChange >= miniDeltaRate) {
      const direction = Math.sign(deltaChange) || 1;
      const slope = absDeltaChange / secondsSpan;
      visibleRate = direction * Math.max(minShownRate, slope);
    } else {
      visibleRate = 0;
    }
  }

  const rateDirection = Math.sign(visibleRate);
  const rateMagnitude = Math.abs(visibleRate);

  // Normalizes the current rate  depending on the rate magnitude
  const normalized = rateMagnitude / Math.max(midRate, 1e-6);
  // When its near 0 the bar smoothly goes to the middle so it doesnt jitter
  const softSaturate = normalized / (1 + saturationGain * normalized); 
  const visibilityCurve = Math.pow(softSaturate, smallRateBooster);

  const isZero = rateMagnitude === 0;
  const fillOpacity = isZero
    ? 0
    : Math.max(minFillOpacity, Math.min(1, visibilityCurve));
  const fillLength = isZero
    ? 0
    : Math.max(minFillLen, Math.min(1, visibilityCurve));

  // gaining on Car A green (left)
  const leftScale = rateDirection < 0 ? fillLength : 0; 
  // losing on Car A red (right)
  const rightScale = rateDirection > 0 ? fillLength : 0;
  return (
    <div className="delta-card">
      <div className="delta-top">
        <div className="delta-title">Live Δ (B vs A)</div>
        <div className={`delta-value ${gapClass(totalDelta)}`}>
          {gapFormatter(totalDelta)} s
        </div>
      </div>

      <div className="delta-bar">
        <div className="delta-half delta-left">
          <div
            className="delta-fill negative"
            style={{
              transform: `scaleX(${leftScale})`,
              "--fill-alpha-strong": String(0.55 * fillOpacity),
              "--fill-alpha-weak": String(0.2 * fillOpacity + 0.1),
            }}
            aria-hidden
          />
        </div>

        <div className="delta-center-line" aria-hidden />

        <div className="delta-half delta-right">
          <div
            className="delta-fill positive"
            style={{
              transform: `scaleX(${rightScale})`,
              "--fill-alpha-strong": String(0.55 * fillOpacity),
              "--fill-alpha-weak": String(0.2 * fillOpacity + 0.1),
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* Legend shows the scale in s/s */}
      <div className="delta-scale">
        <span>-{midRate.toFixed(3)} s/s</span>
        <span>0</span>
        <span>+{midRate.toFixed(3)} s/s</span>
      </div>

      <div className="delta-roc">
        <span className="muted">Gain/Loss rate:</span>{" "}
        <strong
          className={
            visibleRate === 0 ? "" : visibleRate > 0 ? "warning" : "success"
          }
        >
          {`${visibleRate >= 0 ? "+" : ""}${visibleRate.toFixed(4)} s/s`}
        </strong>
      </div>
    </div>
  );
}
