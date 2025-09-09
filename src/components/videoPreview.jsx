import { useEffect, useRef, useState } from "react";

// Shows two side-by-side video players (Car A and Car B),
// tracks their playback progress, and provides simple playback controls.
export default function VideoPreview({ videoA, videoB }) {
  // References to each video element
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  // Current playback times
  const [timeA, setTimeA] = useState(0);
  const [timeB, setTimeB] = useState(0);

  // Keep track of current playback time for each video
  useEffect(() => {
    let rafId;
    const update = () => {
      if (videoARef.current) setTimeA(videoARef.current.currentTime || 0);
      if (videoBRef.current) setTimeB(videoBRef.current.currentTime || 0);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Waits until a video is ready to play (metadata + decode)
  const videoIsLoaded = (video) =>
    new Promise((resolve) => {
      if (!video) return resolve();
      if (video.readyState >= 2) return resolve(); 
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        resolve();
      };
      video.addEventListener("canplay", onCanPlay);
    });

  // snap B to A on the very first decoded frame after resume
  const snapOnFirstFrame = () => {
    const a = videoARef.current,
      b = videoBRef.current;
    if (!a || !b || typeof a.requestVideoFrameCallback !== "function") return;
    a.requestVideoFrameCallback(() => {
      b.currentTime = a.currentTime;
    });
  };

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

  // Playback controls
  const playBoth = async () => {
    const a = videoARef.current,
      b = videoBRef.current;
    if (!a || !b) return;

    // make sure both have data ready
    await Promise.all([videoIsLoaded(a), videoIsLoaded(b)]);
    // start from the exact same timestamp
    b.currentTime = a.currentTime;
    // reset correction state
    b.playbackRate = 1;
    // eliminate start jitter on the first decoded frame
    snapOnFirstFrame();

    await Promise.allSettled([a.play(), b.play()]);
  };

  const pauseBoth = () => {
    const a = videoARef.current,
      b = videoBRef.current;
    a?.pause();
    b?.pause();
    if (a && b) b.currentTime = a.currentTime;
  };

  const resetBoth = () => {
    pauseBoth();
    if (videoARef.current) videoARef.current.currentTime = 0;
    if (videoBRef.current) videoBRef.current.currentTime = 0;
    setTimeA(0);
    setTimeB(0);
  };

  return (
    <div className="preview-container">
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
              />
              <div className="hud">
                <div className="tag">Car A</div>
                <div className="time">
                  {timeFormatter(timeA)} / {timeFormatter(videoA.duration || 0)}
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
              />
              <div className="hud">
                <div className="tag">Car B</div>
                <div className="time">
                  {timeFormatter(timeB)} / {timeFormatter(videoB.duration || 0)}
                </div>
              </div>
            </>
          ) : (
            <div className="video-placeholder">Upload Car B to preview</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button
          className="btn"
          onClick={playBoth}
          disabled={!videoA || !videoB}
        >
          Play
        </button>
        <button className="btn" onClick={pauseBoth}>
          Pause
        </button>
        <button className="btn" onClick={resetBoth}>
          Reset
        </button>
      </div>
    </div>
  );
}
