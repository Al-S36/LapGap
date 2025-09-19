import { useState, useEffect, useRef } from "react";
import Header from "./components/Header.jsx";
import UploadArea from "./components/UploadArea.jsx";
import VideoPreview from "./components/videoPreview.jsx";
import StatsStrip from "./components/statsStrip.jsx";
import Footer from "./components/Footer.jsx";
import DeltaCard from "./components/deltaCard.jsx";
import TrackSettings from "./components/TrackSettings.jsx";

// styling
import "./styling/base.css";
import "./styling/homePage.css";
import "./styling/navBars.css";
import "./styling/upload.css";
import "./styling/preview.css";
import "./styling/stats.css";
import "./styling/delta.css";

export default function App() {
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);

  const [titleA] = useState("Car A");
  const [titleB] = useState("Car B");

  const [liveDelta, setLiveDelta] = useState(0);

  const [deltaSamples, setDeltaSamples] = useState([]);
  const deltaBucketsRef = useRef(new Array(101).fill(null));
  const [anchorPairs, setAnchorPairs] = useState(null);

  const [globalTime, setGlobalTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const sessionKey = `${videoA?.url ?? ""}|${videoB?.url ?? ""}`;

  const [track, setTrack] = useState({ name: "", lengthKm: null });

  // Updating the track name and length
  useEffect(() => {
    const handler = (e) => setTrack(e.detail);
    window.addEventListener("trackSettings:update", handler);
    return () => window.removeEventListener("trackSettings:update", handler);
  }, []);

  // Reset buckets whenever either video changes
  useEffect(() => {
    deltaBucketsRef.current = new Array(101).fill(null);
    setDeltaSamples([]);
    setAnchorPairs(null);
    setGlobalTime(0);
    setIsScrubbing(false);
  }, [videoA?.url, videoB?.url]);

  // Recording the new data sample at the given lap
  const recordDeltaSample = (lapProgress, rawDelta) => {
    // Ensure that if progress is null or infinity to becomes 0
    const safeProgress = Number.isFinite(lapProgress)
      ? Math.min(1, Math.max(0, lapProgress))
      : 0;
    const bucketIndex = Math.round(safeProgress * 100);

    const deltaValue = Number.isFinite(rawDelta) ? rawDelta : 0;
    deltaBucketsRef.current[bucketIndex] = deltaValue;

    // Rebuild array of samples
    const samples = [];
    for (let i = 0; i <= 100; i++) {
      const d = deltaBucketsRef.current[i];
      if (typeof d === "number") samples.push({ p: i / 100, delta: d });
    }
    // Update state so that StatsStrip and others can use the new samples
    setDeltaSamples(samples);
  };

  // Durations for stats (and helpful elsewhere)
  const durationA = videoA?.duration ?? 0;
  const durationB = videoB?.duration ?? 0;

  // Follow playback only when no scrubbing so to not fight the user
  const handleTimes = ({ timeA, timeB }) => {
    if (isScrubbing) return;
    setGlobalTime((prev) => {
      const t = Math.max(timeA || 0, timeB || 0);
      return Math.abs(t - prev) > 1e-3 ? t : prev;
    });
  };

  const handleSeek = (t) => setGlobalTime(t);

  // Scrub lifecycle
  const handleScrubStart = () => setIsScrubbing(true);
  const handleScrubEnd = () => setIsScrubbing(false);

  return (
    <div className="home-page">
      <Header />

      <main className="container">
        {/* Track Settings */}
        <section className="card">
          <TrackSettings />
        </section>

        {/* Uploaders */}
        <section className="card responsive-grid-2">
          <UploadArea
            label="Car A"
            hint="Upload the faster lap here"
            onLoaded={(media) =>
              setVideoA(media ? { ...media, title: titleA } : null)
            }
          />
          <UploadArea
            label="Car B"
            hint="Upload the slower lap here"
            onLoaded={(media) =>
              setVideoB(media ? { ...media, title: titleB } : null)
            }
          />
        </section>

        {/* Live Delta summary */}
        <section className="card">
          <DeltaCard totalDelta={liveDelta} />
        </section>

        {/* Dual player */}
        <section className="card">
          <VideoPreview
            videoA={videoA}
            videoB={videoB}
            onDelta={(smoothed, progress, raw) => {
              setLiveDelta(smoothed);
              recordDeltaSample(progress, raw ?? smoothed);
            }}
            onAnchors={setAnchorPairs}
            onTimes={handleTimes}
            seekTo={isScrubbing ? globalTime : undefined}
            globalTime={globalTime}
            onSeek={handleSeek}
            onScrubStart={handleScrubStart}
            onScrubEnd={handleScrubEnd}
          />
        </section>

        {/* Stats */}
        <section className="card">
          <StatsStrip
            lapTimeA={videoA?.duration ?? 0}
            lapTimeB={videoB?.duration ?? 0}
            liveDelta={liveDelta}
            deltaSamples={deltaSamples}
            sessionKey={sessionKey}
            anchorPairs={anchorPairs}
            trackLengthKm={track.lengthKm}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
