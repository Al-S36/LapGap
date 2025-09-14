import { useEffect, useRef, useState } from "react";
import { timeFormatter } from "./services/timeFormatter";
import { playBoth, pauseBoth, resetBoth } from "./services/videoSync";
import { clamp, buildWarp, mapAtoB } from "./services/mapping";

// Shows two side-by-side video players (Car A and Car B),
// tracks their playback progress, and provides simple playback controls.
export default function VideoPreview({ videoA, videoB, onDelta, onAnchors }) {
  // References to each video element
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  // Current playback times
  const [timeA, setTimeA] = useState(0);
  const [timeB, setTimeB] = useState(0);

  // overlay
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayTop, setOverlayTop] = useState("B"); // "A" | "B"
  const [overlayAlpha, setOverlayAlpha] = useState(0.5);

  // reference mode
  const [refMode, setRefMode] = useState(false);
  const [sampleTimesA, setSampleTimesA] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [warp, setWarp] = useState(null);
  const [deltaSmoothed, setDeltaSmoothed] = useState(null);

  // Muted states, by defult its muted
  const [isMutedA, setIsMutedA] = useState(true);
  const [isMutedB, setIsMutedB] = useState(true);

  // Apply mute state to the video elements whenever it changes
  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (videoA) videoA.muted = !!isMutedA;
    if (videoB) videoB.muted = !!isMutedB;
  }, [isMutedA, isMutedB]);

  const prevDeltaRef = useRef(null);

  // Keep track of current playback time for each video
  useEffect(() => {
    let rafId;
    const update = () => {
      const videoA = videoARef.current;
      const videoB = videoBRef.current;

      if (videoA) setTimeA(videoA.currentTime || 0);
      if (videoB) setTimeB(videoB.currentTime || 0);

      if (videoA && videoB) {
        const currentTimeA = videoA.currentTime || 0;
        const currentTimeB = videoB.currentTime || 0;

        // If we have a warp mapping we use it otherwise we use the raw differenbce
        let rawDelta;
        if (warp) {
          const mappedTimeB = mapAtoB(warp, currentTimeA);
          rawDelta = mappedTimeB - currentTimeA || 0;
        } else {
          rawDelta = currentTimeB - currentTimeA || 0;
        }

        // Smooth for readability
        const smoothingFactor = 0.3;
        const prev = prevDeltaRef.current;
        const smoothed =
          prev == null
            ? rawDelta
            : smoothingFactor * rawDelta + (1 - smoothingFactor) * prev;

        prevDeltaRef.current = smoothed;
        setDeltaSmoothed(smoothed);

        // Progress along lap A 
        const durationA = videoA.duration || 0;
        const progress =
          durationA > 0 ? clamp(currentTimeA / durationA, 0, 1) : 0;

        // Send smoothed, progress, raw
        if (onDelta) onDelta(smoothed, progress, rawDelta);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [warp, onDelta]);

  // The play back controls
  const onPlay = () => playBoth(videoARef.current, videoBRef.current);
  const onPause = () => pauseBoth(videoARef.current, videoBRef.current);
  const onReset = () => {
    resetBoth(videoARef.current, videoBRef.current);
    setTimeA(0);
    setTimeB(0);
  };

  // Ready to start reference/alignment mode?
  const canStartRef = !!(
    videoA?.url &&
    videoB?.url &&
    videoA?.duration > 2 &&
    videoB?.duration > 2
  );

  const startReferenceMode = () => {
    if (!canStartRef) return;
    setRefMode(true);

    const durationA = videoA?.duration || 0;
    const durationB = videoB?.duration || 0;

    // 20 possible anchors for accuracy, spaced out in the middle 94% of the video
    const innerAnchorCount = 20;
    const edgeMarginRatio = 0.03;
    const anchorSpanRatio = 1 - 2 * edgeMarginRatio;

    // Build evenly spread anchor times (with edge margins)
    const anchorTimes = [0];
    for (let i = 0; i < innerAnchorCount; i++) {
      const ratio =
        edgeMarginRatio + (anchorSpanRatio * i) / (innerAnchorCount - 1);
      anchorTimes.push(ratio * durationA);
    }
    anchorTimes.push(durationA);
    setSampleTimesA(anchorTimes);

    // Setting the first and last anchor points and locking them
    setPairs([
      { id: 0, tA: 0, tB: 0, locked: true },
      {
        id: anchorTimes.length - 1,
        tA: durationA,
        tB: durationB,
        locked: true,
      },
    ]);

    // Start at first anchor point
    setCurrentIdx(1);
    // Clearing the previous mapping
    setWarp(null);

    // Cue both videos to that anchor
    if (videoARef.current) videoARef.current.currentTime = anchorTimes[1] || 0;
    if (videoBRef.current) {
      const initialGuessB =
        (anchorTimes[1] || 0) * (durationB / Math.max(durationA, 1));
      videoBRef.current.currentTime = clamp(initialGuessB, 0, durationB);
    }
  };

  const stopReferenceMode = () => setRefMode(false);

  // timestamp of Car A for the anchor point
  const currentTA = sampleTimesA[currentIdx] ?? 0;
  // The pair the user has created for this anchor
  const currentPair = pairs.find((p) => p.id === currentIdx);
  // Used to lock the anchors, currently just for the first and last points
  const isLocked = !!currentPair?.locked;

  // Refrence mode
  useEffect(() => {
    if (!refMode) return;
    const tA = sampleTimesA[currentIdx];
    if (tA == null) return;

    if (videoARef.current) videoARef.current.currentTime = tA;

    // Check if there is an existing pair of anchor points
    const existing = pairs.find((p) => p.id === currentIdx);
    if (videoBRef.current) {
      if (existing) {
        videoBRef.current.currentTime = existing.tB;
      } else {
        // if not paired then scale Car Bs time by scaliong Car As time to the lap duration
        const guess = tA * ((videoB?.duration || 0) / (videoA?.duration || 1));
        videoBRef.current.currentTime = clamp(guess, 0, videoB?.duration || 0);
      }
    }
  }, [
    refMode,
    currentIdx,
    sampleTimesA,
    pairs,
    videoA?.duration,
    videoB?.duration,
  ]);

  // Gets FPS from meta data, fallsback to 30fps
  const fpsB = videoB?.fps || 30;
  // Calculates how much time one frame is
  const frameStep = 1 / fpsB;
  // allows user to go back and forth either by frame or by 0.1s
  const nudgeVideoBTime = (dt) => {
    const videoB = videoBRef.current;
    if (!videoB) return;
    videoB.currentTime = clamp(
      (videoB.currentTime || 0) + dt,
      0,
      videoB?.duration || 0
    );
  };

  // Setting a pair of anchor points
  const setPairAtCurrent = () => {
    const videoB = videoBRef.current;
    if (!refMode || !videoB) return;

    const timeB = videoB.currentTime || 0;
    const timeA = currentTA;

    setPairs((prevPairs) => {
      const isEndpointLocked = prevPairs.find(
        (pair) => pair.id === currentIdx
      )?.locked;

      // Remove any existing pair for this anchor index, then create the new one
      const pairsWithoutCurrent = prevPairs.filter(
        (pair) => pair.id !== currentIdx
      );

      return [
        ...pairsWithoutCurrent,
        { id: currentIdx, tA: timeA, tB: timeB, locked: !!isEndpointLocked },
      ].sort((p1, p2) => p1.id - p2.id);
    });
  };

  // Remove the pair at the current anchor unless its locked
  const removeCurrentPair = () => {
    setPairs((prevPairs) => {
      const current = prevPairs.find((p) => p.id === currentIdx);
      if (current?.locked) return prevPairs;
      return prevPairs.filter((p) => p.id !== currentIdx);
    });
  };

  // Build the time-warp mapping from the collected pairs
  const buildMapping = () => {
    const totalDurationA = videoA?.duration || 0;
    const totalDurationB = videoB?.duration || 0;

    // Ensure we have start/end guard pairs
    const needsStartPair = !pairs.some((p) => p.tA === 0);
    const needsEndPair = !pairs.some(
      (p) => Math.abs(p.tA - totalDurationA) < 1e-3
    );

    // Only use these guards for building the mapping
    const mergedPairs = [
      ...(needsStartPair ? [{ id: 0, tA: 0, tB: 0, locked: true }] : []),
      ...(needsEndPair
        ? // large id just to sort after everything else
          [{ id: 999999, tA: totalDurationA, tB: totalDurationB, locked: true }]
        : []),
      ...pairs,
    ];

    // Sort by Car A time and keep only the (tA, tB)
    const mappingPoints = mergedPairs
      .slice()
      .sort((p1, p2) => p1.tA - p2.tA)
      .map(({ tA, tB }) => ({ tA, tB }));

    if (mappingPoints.length < 6) {
      alert("Add at least 6 matched points (endpoints are auto-added).");
      return;
    }

    setWarp(buildWarp(mappingPoints));
    setRefMode(false);
    if (typeof onAnchors === "function") {
      onAnchors(mappingPoints);
    }
  };

  return (
    <div className="preview-container">
      {!overlayMode ? (
        <div className="players responsive-grid-2">
          {/* Car A */}
          <div className="player">
            {videoA?.url ? (
              <>
                <video
                  ref={videoARef}
                  src={videoA.url}
                  playsInline
                  preload="auto"
                  muted={isMutedA}
                  defaultMuted={isMutedA}
                />
                <div className="hud">
                  <div className="tag">Car A</div>
                  <div className="time">
                    {timeFormatter(timeA)} /{" "}
                    {timeFormatter(videoA.duration || 0)}
                  </div>
                </div>
              </>
            ) : (
              <div className="video-placeholder">Upload Car A to preview</div>
            )}
          </div>

          {/* Car B */}
          <div className="player">
            {videoB?.url ? (
              <>
                <video
                  ref={videoBRef}
                  src={videoB.url}
                  playsInline
                  preload="auto"
                  muted={isMutedB}
                  defaultMuted={isMutedB}
                />
                <div className="hud">
                  <div className="tag">Car B</div>
                  <div className="time">
                    {timeFormatter(timeB)} /{" "}
                    {timeFormatter(videoB.duration || 0)}
                  </div>
                </div>
              </>
            ) : (
              <div className="video-placeholder">Upload Car B to preview</div>
            )}
          </div>
        </div>
      ) : (
        /* Overlay layout */
        <div className="player overlay-stack">
          {videoA?.url && videoB?.url ? (
            <>
              {/* Base layer */}
              <video
                ref={overlayTop === "A" ? videoBRef : videoARef}
                src={(overlayTop === "A" ? videoB?.url : videoA?.url) || ""}
                playsInline
                preload="auto"
                muted={overlayTop === "A" ? isMutedB : isMutedA}
                defaultMuted={overlayTop === "A" ? isMutedB : isMutedA}
              />

              {/* Top layer */}
              <video
                ref={overlayTop === "A" ? videoARef : videoBRef}
                src={(overlayTop === "A" ? videoA?.url : videoB?.url) || ""}
                playsInline
                preload="auto"
                className="overlay-top"
                style={{ "--overlay-alpha": overlayAlpha }}
                muted={overlayTop === "A" ? isMutedA : isMutedB}
                defaultMuted={overlayTop === "A" ? isMutedA : isMutedB}
              />

              {/* Overlay HUD slider */}
              <div className="hud hud-br">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="tag">Overlay</div>
                  <div className="muted">Top: {overlayTop}</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(overlayAlpha * 100)}
                  onChange={(e) =>
                    setOverlayAlpha(Number(e.target.value) / 100)
                  }
                  style={{ width: 160 }}
                  aria-label="Overlay opacity"
                />
                <button
                  className="btn"
                  onClick={() => setOverlayTop((t) => (t === "A" ? "B" : "A"))}
                >
                  Swap Top
                </button>
              </div>

              {/* Times (for overlay its stacked) */}
              <div className="hud">
                <div className="tag">Car A</div>
                <div className="time">
                  {timeFormatter(timeA)} /{" "}
                  {timeFormatter(videoA?.duration || 0)}
                </div>
              </div>
              <div className="hud hud-stack2">
                <div className="tag">Car B</div>
                <div className="time">
                  {timeFormatter(timeB)} /{" "}
                  {timeFormatter(videoB?.duration || 0)}
                </div>
              </div>
            </>
          ) : (
            <div className="video-placeholder">
              Upload both videos to overlay
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="controls controls-split">
        <div className="cluster left">
          <button className="btn" onClick={() => setIsMutedA((v) => !v)}>
            {isMutedA ? "Unmute A" : "Mute A"}
          </button>
        </div>

        <div className="cluster center">
          <button
            className="btn"
            onClick={onPlay}
            disabled={!videoA || !videoB}
          >
            Play
          </button>
          <button className="btn" onClick={onPause}>
            Pause
          </button>
          <button className="btn" onClick={onReset}>
            Reset
          </button>
        </div>

        <div className="cluster right">
          <button className="btn" onClick={() => setIsMutedB((v) => !v)}>
            {isMutedB ? "Unmute B" : "Mute B"}
          </button>
        </div>
      </div>

      <div className="controls controls-sub">
        <div className="cluster center">
          <button
            className={`btn ${overlayMode ? "active" : ""}`}
            onClick={() => setOverlayMode((v) => !v)}
          >
            {overlayMode ? "Overlay: ON" : "Overlay: OFF"}
          </button>

          <button
            className="btn"
            onClick={startReferenceMode}
            disabled={!canStartRef}
          >
            Start Reference Mode
          </button>

          <button
            className="btn"
            onClick={() => setOverlayTop((t) => (t === "A" ? "B" : "A"))}
            disabled={!overlayMode}
          >
            Swap Top ({overlayTop})
          </button>
        </div>

        {refMode && (
          <button className="btn" onClick={stopReferenceMode}>
            Cancel
          </button>
        )}
        {!!warp && <span className="pill">Mapping: ON</span>}
      </div>

      {/* Reference Mode UI */}
      {refMode && (
        <div
          className="reference-panel"
          style={{ marginTop: 12, display: "grid", gap: 8 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div>
              <strong>Reference Point:</strong> {currentIdx + 1} /{" "}
              {sampleTimesA.length}
              <span className="muted" style={{ marginLeft: 8 }}>
                tA = {timeFormatter(currentTA)}
              </span>
              {isLocked && (
                <span className="pill" style={{ marginLeft: 8 }}>
                  Locked
                </span>
              )}
              {currentPair && !currentPair.locked && (
                <span className="muted" style={{ marginLeft: 8 }}>
                  paired
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              >
                ◀ Prev
              </button>
              <button
                className="btn"
                onClick={() =>
                  setCurrentIdx((i) => Math.min(sampleTimesA.length - 1, i + 1))
                }
              >
                Next ▶
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => nudgeVideoBTime(-frameStep)}>
              −1 frame
            </button>
            <button className="btn" onClick={() => nudgeVideoBTime(+frameStep)}>
              +1 frame
            </button>
            <button className="btn" onClick={() => nudgeVideoBTime(-0.1)}>
              −0.1s
            </button>
            <button className="btn" onClick={() => nudgeVideoBTime(+0.1)}>
              +0.1s
            </button>

            <button
              className="btn"
              onClick={setPairAtCurrent}
              disabled={!!isLocked}
            >
              Set pair
            </button>
            <button
              className="btn"
              onClick={removeCurrentPair}
              disabled={!!isLocked}
            >
              Remove pair
            </button>
          </div>

          <div>
            <strong>Pairs set:</strong> {pairs.length}
            {pairs.length >= 6 ? (
              <button
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={buildMapping}
              >
                Finish & Build Mapping
              </button>
            ) : (
              <span className="muted" style={{ marginLeft: 8 }}>
                (need ≥ 6 for stability)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
