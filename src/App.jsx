import { useState, useEffect, useRef } from "react";
import Header from "./components/Header.jsx";
import UploadArea from "./components/UploadArea.jsx";
import VideoPreview from "./components/videoPreview.jsx";
import StatsStrip from "./components/statsStrip.jsx";
import Footer from "./components/Footer.jsx";
import DeltaCard from "./components/deltaCard.jsx";

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

  const sessionKey = `${videoA?.url ?? ""}|${videoB?.url ?? ""}`;

  // Reset buckets whenever either video changes
  useEffect(() => {
    deltaBucketsRef.current = new Array(101).fill(null);
    setDeltaSamples([]);
    setAnchorPairs(null);
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

  return (
    <div className="home-page">
      <Header />

      <main className="container">
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

        <section className="card">
          <DeltaCard totalDelta={liveDelta} />
        </section>

        <section className="card">
          <VideoPreview
            videoA={videoA}
            videoB={videoB}
            onDelta={(smoothed, progress, raw) => {
              setLiveDelta(smoothed);
              recordDeltaSample(progress, raw ?? smoothed);
            }}
            onAnchors={setAnchorPairs}
          />
        </section>

        <section className="card">
          <StatsStrip
            lapTimeA={videoA?.duration ?? 0}
            lapTimeB={videoB?.duration ?? 0}
            liveDelta={liveDelta}
            deltaSamples={deltaSamples}
            sessionKey={sessionKey}
            anchorPairs={anchorPairs}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
