import { useEffect, useRef, useState, useMemo } from "react";
import { timeFormatter } from "./services/timeFormatter";
import { playBoth, pauseBoth, resetBoth } from "./services/videoSync";
import { clamp, buildWarp, mapAtoB } from "./services/mapping";
import TimeScrubber from "./timeScrubber.jsx";

// Shows two side-by-side video players (Car A and Car B),
// tracks their playback progress, and provides simple playback controls.
export default function VideoPreview({
  videoA,
  videoB,
  anchors,
  onDelta,
  onAnchors,
  onTimes,
  seekTo,
  globalTime = 0,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) {
  const containerRef = useRef(null);

  // References to each video element
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  // HUD spans (avoid re-render every frame)
  const timeATextRef = useRef(null);
  const timeBTextRef = useRef(null);
  const totalATextRef = useRef(null);
  const totalBTextRef = useRef(null);

  // overlay
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayTop, setOverlayTop] = useState("B");
  const [overlayAlpha, setOverlayAlpha] = useState(0.5);
  const [useCanvasOverlay, setUseCanvasOverlay] = useState(false);
  const canvasRef = useRef(null);

  // reference mode
  const [refMode, setRefMode] = useState(false);
  const [sampleTimesA, setSampleTimesA] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [warp, setWarp] = useState(null);

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

  // Ready/Buffer indicators
  const [readyA, setReadyA] = useState(false);
  const [readyB, setReadyB] = useState(false);
  const hasBothUrls = !!(videoA?.url && videoB?.url);

  const computeReady = (video) => {
    if (!video) return false;
    if (video.readyState >= 3) return true;
    if (video.readyState >= 2 && video.buffered?.length) {
      const ct = video.currentTime || 0;
      for (let i = 0; i < video.buffered.length; i++) {
        const s = video.buffered.start(i);
        const e = video.buffered.end(i);
        if (ct >= s && ct + 3 <= e) return true;
      }
    }
    return false;
  };

  useEffect(() => {
    const A = videoARef.current;
    const B = videoBRef.current;
    if (!A || !B) return;

    A.preload = "auto";
    B.preload = "auto";

    const updateA = () => setReadyA(computeReady(A));
    const updateB = () => setReadyB(computeReady(B));

    const showTotals = () => {
      if (totalATextRef.current)
        totalATextRef.current.textContent = timeFormatter(A.duration || 0);
      if (totalBTextRef.current)
        totalBTextRef.current.textContent = timeFormatter(B.duration || 0);
    };

    const evts = [
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
      "progress",
      "timeupdate",
      "waiting",
      "stalled",
    ];
    evts.forEach((e) => A.addEventListener(e, updateA));
    evts.forEach((e) => B.addEventListener(e, updateB));
    A.addEventListener("loadedmetadata", showTotals);
    B.addEventListener("loadedmetadata", showTotals);

    updateA();
    updateB();
    showTotals();

    return () => {
      evts.forEach((e) => A.removeEventListener(e, updateA));
      evts.forEach((e) => B.removeEventListener(e, updateB));
      A.removeEventListener("loadedmetadata", showTotals);
      B.removeEventListener("loadedmetadata", showTotals);
    };
  }, [videoA?.url, videoB?.url]);

  // External anchors -> internal
  const externalPairs = useMemo(() => {
    if (!anchors) return null;
    // support [{tA,tB}] or seconds[] (assume 1:1)
    if (Array.isArray(anchors)) {
      if (anchors.length === 0) return [];
      if (typeof anchors[0] === "number") {
        return anchors.map((t, i) => ({
          id: i,
          tA: Number(t) || 0,
          tB: Number(t) || 0,
          locked: i === 0 || i === anchors.length - 1,
        }));
      }
      return anchors
        .map((p, i) => ({
          id: i,
          tA: Number(p?.tA) || 0,
          tB: Number(p?.tB) || 0,
          locked: i === 0 || i === anchors.length - 1,
        }))
        .sort((a, b) => a.tA - b.tA);
    }
    return null;
  }, [anchors]);

  useEffect(() => {
    if (!externalPairs || externalPairs.length < 2) return;
    // adopt external pairs & build warp
    setPairs(externalPairs);
    const mapping = externalPairs.map(({ tA, tB }) => ({ tA, tB }));
    setWarp(buildWarp(mapping));
    setRefMode(false);
  }, [externalPairs]);

  // Throttled HUD + delta (15 Hz)
  const lastTickRef = useRef(0);
  const TICK_MS = 1000 / 15;
  const rafIdRef = useRef(0);
  const rvfcActiveRef = useRef(false);

  const updateLoop = () => {
    const A = videoARef.current;
    const B = videoBRef.current;
    if (!A || !B) {
      rafIdRef.current = requestAnimationFrame(updateLoop);
      return;
    }

    const now = performance.now();
    if (now - lastTickRef.current >= TICK_MS) {
      lastTickRef.current = now;

      const tA = A.currentTime || 0;
      const tB = B.currentTime || 0;

      if (timeATextRef.current)
        timeATextRef.current.textContent = timeFormatter(tA);
      if (timeBTextRef.current)
        timeBTextRef.current.textContent = timeFormatter(tB);

      let rawDelta = warp ? mapAtoB(warp, tA) - tA || 0 : tB - tA || 0;

      // Soft-sync B to A
      if (!refMode && !A.paused && !B.paused) {
        const MAX_RATE_ADJ = 0.08;
        const KP = 0.5;
        const BIG_DELTA = 0.35;
        const SEEK_STEP = 0.15;

        if (Math.abs(rawDelta) < BIG_DELTA) {
          const targetRate =
            1 + clamp(-KP * rawDelta, -MAX_RATE_ADJ, MAX_RATE_ADJ);
          if (Math.abs(B.playbackRate - targetRate) > 0.001)
            B.playbackRate = targetRate;
        } else {
          const dir = Math.sign(rawDelta);
          const target = clamp(
            (B.currentTime || 0) - dir * SEEK_STEP,
            0,
            B.duration || 0
          );
          if (Math.abs((B.currentTime || 0) - target) > 0.001)
            B.currentTime = target;
          if (Math.abs(B.playbackRate - 1) > 0.001) B.playbackRate = 1;
        }
      } else {
        if (B && Math.abs(B.playbackRate - 1) > 0.001) B.playbackRate = 1;
      }

      if (typeof onTimes === "function") onTimes({ timeA: tA, timeB: tB });
      if (typeof onDelta === "function") {
        const progress = A.duration > 0 ? clamp(tA / A.duration, 0, 1) : 0;
        onDelta(rawDelta * 0.7, progress, rawDelta);
      }
    }

    rafIdRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    const A = videoARef.current;
    const supportsRVFC = A && typeof A.requestVideoFrameCallback === "function";
    if (supportsRVFC) {
      const step = () => {
        updateLoop();
        if (rvfcActiveRef.current) A.requestVideoFrameCallback(step);
      };
      rvfcActiveRef.current = true;
      A.requestVideoFrameCallback(step);
      return () => {
        rvfcActiveRef.current = false;
      };
    } else {
      rafIdRef.current = requestAnimationFrame(updateLoop);
      return () => cancelAnimationFrame(rafIdRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warp, onDelta, onTimes]);

  // Seek from parent
  useEffect(() => {
    if (!Number.isFinite(seekTo)) return;
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (videoA) {
      const dA = Number(videoA.duration) || 0;
      videoA.currentTime = clamp(seekTo, 0, Math.max(0, dA - 0.001));
    }
    if (videoB) {
      const dB = Number(videoB.duration) || 0;
      videoB.currentTime = clamp(seekTo, 0, Math.max(0, dB - 0.001));
    }
  }, [seekTo]);

  // Stall recovery
  const jumpToNearestBuffered = (v) => {
    if (!v || !v.buffered || v.buffered.length === 0) return false;
    const t = v.currentTime || 0;
    for (let i = 0; i < v.buffered.length; i++) {
      const s = v.buffered.start(i);
      const e = v.buffered.end(i);
      if (t >= s && t <= e) {
        const margin = 0.08;
        if (t > e - margin && i + 1 < v.buffered.length) {
          v.currentTime = v.buffered.start(i + 1) + margin;
          return true;
        }
        return false;
      }
    }
    const nextStart = v.buffered.start(0);
    if (nextStart > t) {
      v.currentTime = nextStart + 0.02;
      return true;
    }
    return false;
  };

  useEffect(() => {
    const A = videoARef.current,
      B = videoBRef.current;
    if (!A || !B) return;
    const onA = () => jumpToNearestBuffered(A);
    const onB = () => jumpToNearestBuffered(B);
    ["waiting", "stalled"].forEach((ev) => {
      A.addEventListener(ev, onA);
      B.addEventListener(ev, onB);
    });
    return () => {
      ["waiting", "stalled"].forEach((ev) => {
        A.removeEventListener(ev, onA);
        B.removeEventListener(ev, onB);
      });
    };
  }, [videoA?.url, videoB?.url]);

  // Off-screen pause (saves CPU/GPU)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const A = videoARef.current,
      B = videoBRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) pauseBoth(A, B);
      },
      { threshold: 0 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // Pause on hidden tab
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pauseBoth(videoARef.current, videoBRef.current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Controls
  const tryPlayWhenReady = (el) =>
    new Promise((resolve) => {
      el.play()
        .catch(() => {
          const fn = () => {
            el.removeEventListener("canplay", fn);
            el.play().finally(resolve);
          };
          el.addEventListener("canplay", fn, { once: true });
        })
        .then(resolve);
    });

  const onPlay = () => {
    const A = videoARef.current,
      B = videoBRef.current;
    if (!A || !B) return;
    A.playbackRate = 1;
    B.playbackRate = 1;
    tryPlayWhenReady(A);
    tryPlayWhenReady(B);
  };

  const onPause = () => {
    const A = videoARef.current,
      B = videoBRef.current;
    pauseBoth(A, B);
    if (A) A.playbackRate = 1;
    if (B) B.playbackRate = 1;
  };

  const onReset = () => {
    const A = videoARef.current,
      B = videoBRef.current;
    resetBoth(A, B);
    if (timeATextRef.current)
      timeATextRef.current.textContent = timeFormatter(0);
    if (timeBTextRef.current)
      timeBTextRef.current.textContent = timeFormatter(0);
    if (A) A.playbackRate = 1;
    if (B) B.playbackRate = 1;
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

    setPairs((prev) => {
      const isEndpointLocked = prev.find((p) => p.id === currentIdx)?.locked;
      const without = prev.filter((p) => p.id !== currentIdx);
      return [
        ...without,
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

  const durationA = videoA?.duration ?? 0;
  const durationB = videoB?.duration ?? 0;

  // anchors used here to make markers on the video timeline
  const externalAnchorTimes = useMemo(() => {
    if (!anchors) return [];
    if (!Array.isArray(anchors)) return [];
    if (anchors.length === 0) return [];
    if (typeof anchors[0] === "number") return anchors;
    return anchors.map((p) => Number(p?.tA) || 0);
  }, [anchors]);

  const timelineAnchors = refMode
    ? sampleTimesA || []
    : externalAnchorTimes.length
    ? externalAnchorTimes
    : (pairs || []).map((p) => p.tA).filter((t) => Number.isFinite(t));

  const highlightAnchorAt = refMode ? currentTA : null;

  // Fast scrubbing
  const handleSeek = (t) => {
    const A = videoARef.current;
    const B = videoBRef.current;
    if (A) A.fastSeek ? A.fastSeek(t) : (A.currentTime = t);
    if (B) B.fastSeek ? B.fastSeek(t) : (B.currentTime = t);
    onSeek?.(t);
  };

  // Resize canvas to container for crisp rendering (devicePixelRatio aware)
  useEffect(() => {
    if (!(overlayMode && useCanvasOverlay)) return;
    const host = containerRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ro = new ResizeObserver(() => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cw = host.clientWidth;
      const ch = host.clientHeight;
      canvas.width = Math.max(1, Math.floor(cw * dpr));
      canvas.height = Math.max(1, Math.floor(ch * dpr));
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [overlayMode, useCanvasOverlay]);

  useEffect(() => {
    if (!(overlayMode && useCanvasOverlay)) return;
    const A = videoARef.current;
    const B = videoBRef.current;
    const canvas = canvasRef.current;
    if (!A || !B || !canvas) return;
    const ctx = canvas.getContext("2d");

    let stop = false;
    const drawContain = (video) => {
      if (!video || !video.videoWidth || !video.videoHeight) return;
      const cw = canvas.width,
        ch = canvas.height;
      const vw = video.videoWidth,
        vh = video.videoHeight;
      const scale = Math.min(cw / vw, ch / vh);
      const dw = Math.floor(vw * scale);
      const dh = Math.floor(vh * scale);
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.drawImage(video, dx, dy, dw, dh);
    };

    const loop = () => {
      if (stop) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const base = overlayTop === "A" ? B : A;
      const top = overlayTop === "A" ? A : B;

      drawContain(base);
      ctx.globalAlpha = overlayAlpha;
      drawContain(top);
      ctx.globalAlpha = 1;

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      stop = true;
    };
  }, [overlayMode, useCanvasOverlay, overlayTop, overlayAlpha]);

  return (
    <div
      ref={containerRef}
      className="preview-container"
      style={{ contain: "layout paint", willChange: "transform" }}
    >
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
                  disablePictureInPicture
                  style={{ willChange: "transform" }}
                />
                <div className="hud">
                  <div className="tag">Car A</div>
                  <div className="time">
                    <span ref={timeATextRef}>00:00.000</span> /{" "}
                    <span ref={totalATextRef}>00:00.000</span>
                    {!readyA && (
                      <span className="muted" style={{ marginLeft: 8 }}>
                        buffering…
                      </span>
                    )}
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
                  disablePictureInPicture
                  style={{ willChange: "transform" }}
                />
                <div className="hud">
                  <div className="tag">Car B</div>
                  <div className="time">
                    <span ref={timeBTextRef}>00:00.000</span> /{" "}
                    <span ref={totalBTextRef}>00:00.000</span>
                    {!readyB && (
                      <span className="muted" style={{ marginLeft: 8 }}>
                        buffering…
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="video-placeholder">Upload Car B to preview</div>
            )}
          </div>
        </div>
      ) : (
        // Overlay layout
        <div className="player overlay-stack">
          {videoA?.url && videoB?.url ? (
            <>
              {useCanvasOverlay ? (
                <>
                  {/* Keep videos decoding but off-screen to avoid compositing cost */}
                  <video
                    ref={overlayTop === "A" ? videoBRef : videoARef}
                    src={(overlayTop === "A" ? videoB?.url : videoA?.url) || ""}
                    playsInline
                    preload="auto"
                    muted={overlayTop === "A" ? isMutedB : isMutedA}
                    disablePictureInPicture
                    style={{
                      position: "absolute",
                      left: -10000,
                      top: -10000,
                      width: 1,
                      height: 1,
                    }}
                  />
                  <video
                    ref={overlayTop === "A" ? videoARef : videoBRef}
                    src={(overlayTop === "A" ? videoA?.url : videoB?.url) || ""}
                    playsInline
                    preload="auto"
                    muted={overlayTop === "A" ? isMutedA : isMutedB}
                    disablePictureInPicture
                    style={{
                      position: "absolute",
                      left: -10000,
                      top: -10000,
                      width: 1,
                      height: 1,
                    }}
                  />
                  <canvas ref={canvasRef} className="overlay-canvas" />
                </>
              ) : (
                <>
                  {/* Base layer */}
                  <video
                    ref={overlayTop === "A" ? videoBRef : videoARef}
                    src={(overlayTop === "A" ? videoB?.url : videoA?.url) || ""}
                    playsInline
                    preload="auto"
                    muted={overlayTop === "A" ? isMutedB : isMutedA}
                    disablePictureInPicture
                    style={{ willChange: "opacity, transform" }}
                  />

                  {/* Top layer */}
                  <video
                    ref={overlayTop === "A" ? videoARef : videoBRef}
                    src={(overlayTop === "A" ? videoA?.url : videoB?.url) || ""}
                    playsInline
                    className="overlay-top"
                    style={{
                      "--overlay-alpha": overlayAlpha,
                      willChange: "opacity, transform",
                    }}
                    muted={overlayTop === "A" ? isMutedA : isMutedB}
                    disablePictureInPicture
                  />
                </>
              )}

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
                  <span ref={timeATextRef}>00:00.000</span> /{" "}
                  <span ref={totalATextRef}>00:00.000</span>
                  {!readyA && (
                    <span className="muted" style={{ marginLeft: 8 }}>
                      buffering…
                    </span>
                  )}
                </div>
              </div>
              <div className="hud hud-stack2">
                <div className="tag">Car B</div>
                <div className="time">
                  <span ref={timeBTextRef}>00:00.000</span> /{" "}
                  <span ref={totalBTextRef}>00:00.000</span>
                  {!readyB && (
                    <span className="muted" style={{ marginLeft: 8 }}>
                      buffering…
                    </span>
                  )}
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

      {/* Scrubber */}
      <div style={{ marginTop: 12 }}>
        <TimeScrubber
          durationA={durationA}
          durationB={durationB}
          value={globalTime}
          onSeek={handleSeek}
          onSeekStart={onScrubStart}
          onSeekEnd={onScrubEnd}
          anchors={timelineAnchors}
          highlightAt={highlightAnchorAt}
        />
      </div>

      {/* Controls */}
      <div className="controls controls-split">
        <div className="cluster left">
          <button className="btn" onClick={() => setIsMutedA((v) => !v)}>
            {isMutedA ? "Unmute A" : "Mute A"}
          </button>
        </div>

        <div className="cluster center">
          <button className="btn" onClick={onPlay} disabled={!hasBothUrls}>
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

          {/* Canvas performance mode toggle (only meaningful in overlay) */}
          <button
            className={`btn ${useCanvasOverlay ? "active" : ""}`}
            onClick={() => setUseCanvasOverlay((v) => !v)}
            disabled={!overlayMode}
            title="Render overlay via Canvas to reduce compositing cost"
          >
            Perf Mode: {useCanvasOverlay ? "Canvas" : "DOM"}
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
