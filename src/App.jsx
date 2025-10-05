import { useState, useEffect, useRef } from "react";
import Header from "./components/header.jsx";
import UploadArea from "./components/UploadArea.jsx";
import VideoPreview from "./components/videoPreview.jsx";
import StatsStrip from "./components/statsStrip.jsx";
import Footer from "./components/footer.jsx";
import DeltaCard from "./components/deltaCard.jsx";
import TrackSettings from "./components/TrackSettings.jsx";
import generateReport from "./components/services/generateReport.js";
import {
  createLapPack,
  buildDefaultPackFilename,
} from "./components/services/export/pack.js";
import { downloadBlob } from "./components/services/export/donwload.js";
import { readLapPack } from "./components/services/import/readPack.js";

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

  const [track, setTrack] = useState({ name: "", lengthKm: "0.01" });

  // Stats lifted from StatsStrip for the PDF
  const [theoreticalBest, setTheoreticalBest] = useState(null);
  const [consistencyPct, setConsistencyPct] = useState(null);
  const [leadSharePctA, setLeadSharePctA] = useState(null);

  // Track (and cars) from TrackSettings
  useEffect(() => {
    const handler = (e) => setTrack(e.detail);
    window.addEventListener("trackSettings:update", handler);
    return () => window.removeEventListener("trackSettings:update", handler);
  }, []);

  // Reset buckets whenever either video changes
  useEffect(() => {
    deltaBucketsRef.current = new Array(101).fill(null);
    setDeltaSamples([]);
    setGlobalTime(0);
    setIsScrubbing(false);
  }, [videoA?.url, videoB?.url]);

  // Record a delta sample at a given lap progress
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

  // Durations (used in StatsStrip props too)
  const durationA = videoA?.duration ?? 0;
  const durationB = videoB?.duration ?? 0;

  // Keep global time in sync during playback (unless scrubbing)
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

  // Import Pack (.zip)
  const onImportPack = async (file) => {
    try {
      if (videoA?.url) URL.revokeObjectURL(videoA.url);
      if (videoB?.url) URL.revokeObjectURL(videoB.url);

      const pack = await readLapPack(file);

      // Normalize anchors
      const importedAnchors = Array.isArray(pack.anchors)
        ? pack.anchors
        : pack.anchors?.pairs || [];

      setTrack(pack.track);
      setAnchorPairs(importedAnchors);
      setVideoA(pack.videoA);
      setVideoB(pack.videoB);

      // Reset session-coupled UI bits
      deltaBucketsRef.current = new Array(101).fill(null);
      setDeltaSamples([]);
      setLiveDelta(0);
      setGlobalTime(0);
      setIsScrubbing(false);
    } catch (err) {
      console.error("Import failed:", err);
      alert(err.message || "Import failed. See console for details.");
    }
  };

  // Header buttons enablement
  const canGenerateReport = Boolean(videoA && videoB);
  const canExportPack = Boolean(videoA?.file && videoB?.file);

  // Export Pack (.zip) handler
  const onExportPack = async () => {
    // quick guard so we fail fast with a friendly message
    if (!videoA?.file || !videoB?.file) {
      alert("Upload both videos to export.");
      return;
    }

    try {
      const blob = await createLapPack({
        track,
        videoA,
        videoB,
        anchors: anchorPairs?.pairs ?? anchorPairs,
      });

      const filename = buildDefaultPackFilename(track?.name || "track");
      downloadBlob(blob, filename);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. See console for details.");
    }
  };

  return (
    <div className="home-page">
      <Header
        onGenerateReport={() =>
          generateReport({
            track,
            videoA,
            videoB,
            liveDelta,
            theoreticalBest,
            consistencyPct,
            leadSharePctA: Number.isFinite(leadSharePctA)
              ? Math.round(leadSharePctA)
              : null,
            deltaSamples,
            anchorPairs: anchorPairs?.pairs ?? anchorPairs,
          })
        }
        canGenerate={canGenerateReport}
        onExportPack={onExportPack}
        canExportPack={canExportPack}
        onImportPack={onImportPack}
      />

      <main className="container">
        {/* Track Settings (populate from imported `track`) */}
        <section className="card">
          <TrackSettings value={track} />
        </section>

        {/* Uploaders */}
        <section className="card responsive-grid-2">
          <UploadArea
            label="Car A"
            hint="Upload the faster lap here"
            value={videoA}
            onLoaded={(media) =>
              setVideoA(media ? { ...media, title: titleA } : null)
            }
          />
          <UploadArea
            label="Car B"
            hint="Upload the slower lap here"
            value={videoB}
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
            anchors={anchorPairs?.pairs ?? anchorPairs}
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
            lapTimeA={durationA}
            lapTimeB={durationB}
            liveDelta={liveDelta}
            deltaSamples={deltaSamples}
            sessionKey={sessionKey}
            anchorPairs={anchorPairs}
            trackLengthKm={track.lengthKm ?? null}
            // Lift values so PDF matches the UI
            onSummary={(s) => {
              if (!s) return;
              setTheoreticalBest(
                Number.isFinite(s.theoreticalBest) ? s.theoreticalBest : null
              );
              setConsistencyPct(
                Number.isFinite(s.consistencyPct) ? s.consistencyPct : null
              );
              setLeadSharePctA(
                Number.isFinite(s.leadSharePctA) ? s.leadSharePctA : null
              );
            }}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
