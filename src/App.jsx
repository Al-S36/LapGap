import { useState } from "react";
import Header from "./components/Header.jsx";
import UploadArea from "./components/UploadArea.jsx";
import VideoPreview from "./components/VideoPreview.jsx";
import StatsStrip from "./components/StatsStrip.jsx";
import Footer from "./components/Footer.jsx";

// styling
import "./styling/base.css";
import "./styling/homePage.css";
import "./styling/navBars.css";
import "./styling/upload.css";
import "./styling/preview.css";
import "./styling/stats.css";

export default function App() {
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);

  const [titleA] = useState("Car A");
  const [titleB] = useState("Car B");

  return (
    <div className="home-page">
      <Header />

      <main className="container">
        <section className="card responsive-grid-2">
          <UploadArea
            label= "Car A"
            hint="Upload the faster lap here"
            onLoaded={(m) => setVideoA(m ? { ...m, title: titleA } : null)}
          />
          <UploadArea
            label= "Car B"
            hint="Upload the slower lap here"
            onLoaded={(m) => setVideoB(m ? { ...m, title: titleB } : null)}
          />
        </section>

        <section className="card">
          <VideoPreview videoA={videoA} videoB={videoB} />
        </section>

        <section className="card">
          <StatsStrip
            lapTimeA={videoA?.duration ?? 0}
            lapTimeB={videoB?.duration ?? 0}
            liveDelta={0}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}