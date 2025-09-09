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
    const playerA = videoARef.current;
    const playerB = videoBRef.current;
    if (!playerA || !playerB) return;

    const handleTimeUpdateA = () => setTimeA(playerA.currentTime || 0);
    const handleTimeUpdateB = () => setTimeB(playerB.currentTime || 0);

    playerA.addEventListener("timeupdate", handleTimeUpdateA);
    playerB.addEventListener("timeupdate", handleTimeUpdateB);

    return () => {
      playerA.removeEventListener("timeupdate", handleTimeUpdateA);
      playerB.removeEventListener("timeupdate", handleTimeUpdateB);
    };
  }, [videoA, videoB]);

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
    try {
      await videoARef.current?.play();
    } catch {}
    try {
      await videoBRef.current?.play();
    } catch {}
  };

  const pauseBoth = () => {
    videoARef.current?.pause();
    videoBRef.current?.pause();
  };

  const resetBoth = () => {
    pauseBoth();
    if (videoARef.current) videoARef.current.currentTime = 0;
    if (videoBRef.current) videoBRef.current.currentTime = 0;
  };

  return (
    <div className="preview-container">
      <div className="players responsive-grid-2">
        {/* Car A */}
        <div className="player">
          {videoA?.url ? (
            <>
              <video ref={videoARef} src={videoA.url} playsInline />
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
              <video ref={videoBRef} src={videoB.url} playsInline />
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
