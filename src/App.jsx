import { useState } from "react";
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

  return (
    <div className="home-page">
      <Header />

      <main className="container">
        <section className="card responsive-grid-2">
          <UploadArea
            label="Car A"
            hint="Upload the faster lap here"
            onLoaded={(m) => setVideoA(m ? { ...m, title: titleA } : null)}
          />
          <UploadArea
            label="Car B"
            hint="Upload the slower lap here"
            onLoaded={(m) => setVideoB(m ? { ...m, title: titleB } : null)}
          />
        </section>

        <section className="card">
          <DeltaCard totalDelta={liveDelta}/>
        </section>

        <section className="card">
          <VideoPreview
            videoA={videoA}
            videoB={videoB}
            onDelta={setLiveDelta}
          />
        </section>

        <section className="card">
          <StatsStrip
            lapTimeA={videoA?.duration ?? 0}
            lapTimeB={videoB?.duration ?? 0}
            liveDelta={liveDelta}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
